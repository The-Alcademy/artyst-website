// ============================================================================
// api/admin/send-repermission.js
// ----------------------------------------------------------------------------
// Sends the re-permission email to subscribers in pending_confirmation status
// who haven't yet received it. Protected by ADMIN_PASSWORD.
//
// Naturally idempotent: queries only rows that lack a 'repermission_sent'
// audit event, so re-running the endpoint won't double-send.
//
// Designed for chunked sending — each call processes up to `limit` rows.
// Caller invokes repeatedly until response says `has_more: false`.
//
// ============================================================================
// USAGE
// ============================================================================
//
// Dry run (no sends, just count):
//   curl -X POST https://<domain>/api/admin/send-repermission \
//     -H "x-admin-password: $ADMIN_PASSWORD" \
//     -H "content-type: application/json" \
//     -d '{"dry_run": true}'
//
// Test send to specific addresses (must already exist in pending_confirmation):
//   curl -X POST https://<domain>/api/admin/send-repermission \
//     -H "x-admin-password: $ADMIN_PASSWORD" \
//     -H "content-type: application/json" \
//     -d '{"test_emails": ["matthew@othersyde.co.uk"]}'
//
// Real send, one batch of up to 500:
//   curl -X POST https://<domain>/api/admin/send-repermission \
//     -H "x-admin-password: $ADMIN_PASSWORD" \
//     -H "content-type: application/json" \
//     -d '{"limit": 500}'
//
// ============================================================================

import { createClient } from '@supabase/supabase-js';

// --- Config ------------------------------------------------------------------
const SITE = process.env.PUBLIC_SITE_URL || 'https://artyst-website.vercel.app';
const RESEND_API = 'https://api.resend.com/emails';

// Sender identity — change here if/when othersyde.co.uk is verified in Resend
const FROM = 'Matthew Taylor <matthew@theartyst.co.uk>';
const REPLY_TO = 'matthew@othersyde.co.uk';
const UNSUB_MAILTO = 'mailto:privacy@othersyde.co.uk?subject=unsubscribe';

// Subject
const SUBJECT = 'Matthew here — still in touch?';

// Batching — Resend paid plan allows 10 req/sec comfortably
const SEND_PARALLELISM = 8; // how many to fire in parallel per tick
const TICK_MS = 1000;        // ms between parallel batches

// Safety cap per call — adjust as needed. Each call processes this many.
const DEFAULT_LIMIT = 500;

// --- HTML escaping -----------------------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Template: HTML ----------------------------------------------------------
function renderHtml({ firstName, confirmUrl, unsubscribeUrl }) {
  const name = firstName ? escapeHtml(firstName) : 'there';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#fafaf8;font-family:Georgia,'Iowan Old Style','Palatino Linotype',serif;color:#1a1a1a;line-height:1.6;-webkit-font-smoothing:antialiased;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <p style="margin:0 0 16px;font-size:17px;">Hi ${name},</p>

  <p style="margin:0 0 16px;font-size:17px;">This is Matthew Taylor from OtherSyde — we're now trading as The Artyst, Cambridge's Syd Barrett heritage venue on Chesterton Road. You're on our historical email list, possibly from a Syd Barrett event or tour, possibly from something else we crossed paths on.</p>

  <p style="margin:0 0 16px;font-size:17px;">It's been a while for many of you, and rather than start sending broadly again without asking, I'm starting with a clean opt-in.</p>

  <p style="margin:0 0 16px;font-size:17px;">If you'd like to stay on our list, please click below:</p>

  <p style="margin:24px 0 24px;">
    <a href="${confirmUrl}" style="display:inline-block;background:#1d5c5c;color:#ffffff;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:600;text-decoration:none;border-radius:4px;">→ Yes, keep me subscribed</a>
  </p>

  <p style="margin:0 0 16px;font-size:17px;">That's the only way we'll keep in touch. Do nothing and we'll quietly remove your email at the end of May — no further emails, no follow-up.</p>

  <hr style="border:none;border-top:1px solid #e5e3dc;margin:32px 0;">

  <p style="margin:0 0 16px;font-size:15px;color:#4a4a4a;">A quick refresh, if it's useful: The Artyst is a café, bar and cultural venue at 54–56 Chesterton Road, Cambridge — the only dedicated Syd Barrett heritage venue in the world, operating with the approval of the Barrett and Mick Rock estates. We host exhibitions, live music, wine tastings and Cambridge walking tours, and the venue is the home of the Invysible College, our learning and cultural initiative. Expect around one email a fortnight at most, about what's coming up.</p>

  <p style="margin:0 0 8px;font-size:17px;">With thanks, either way,</p>
  <p style="margin:0 0 4px;font-size:17px;"><strong>Matthew Taylor</strong></p>
  <p style="margin:0 0 4px;font-size:15px;color:#4a4a4a;">Director, OtherSyde Ltd / The Artyst</p>
  <p style="margin:0 0 32px;font-size:15px;color:#4a4a4a;"><a href="mailto:${REPLY_TO}" style="color:#1d5c5c;">${REPLY_TO}</a> · <a href="https://theartyst.co.uk" style="color:#1d5c5c;">theartyst.co.uk</a></p>

  <p style="margin:32px 0 0;font-size:13px;color:#6a6a6a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <a href="${unsubscribeUrl}" style="color:#6a6a6a;text-decoration:underline;">Unsubscribe immediately</a> ·
    <a href="https://theartyst.co.uk/privacy" style="color:#6a6a6a;text-decoration:underline;">Privacy policy</a>
  </p>
</div>
</body>
</html>`;
}

// --- Template: plain text ----------------------------------------------------
function renderText({ firstName, confirmUrl, unsubscribeUrl }) {
  const name = firstName || 'there';
  return `Hi ${name},

This is Matthew Taylor from OtherSyde — we're now trading as The Artyst, Cambridge's Syd Barrett heritage venue on Chesterton Road. You're on our historical email list, possibly from a Syd Barrett event or tour, possibly from something else we crossed paths on.

It's been a while for many of you, and rather than start sending broadly again without asking, I'm starting with a clean opt-in.

If you'd like to stay on our list, please click the link below:

${confirmUrl}

That's the only way we'll keep in touch. Do nothing and we'll quietly remove your email at the end of May — no further emails, no follow-up.

---

A quick refresh, if it's useful: The Artyst is a café, bar and cultural venue at 54-56 Chesterton Road, Cambridge — the only dedicated Syd Barrett heritage venue in the world, operating with the approval of the Barrett and Mick Rock estates. We host exhibitions, live music, wine tastings and Cambridge walking tours, and the venue is the home of the Invysible College, our learning and cultural initiative. Expect around one email a fortnight at most, about what's coming up.

With thanks, either way,

Matthew Taylor
Director, OtherSyde Ltd / The Artyst
${REPLY_TO} · theartyst.co.uk

Unsubscribe: ${unsubscribeUrl}
Privacy policy: https://theartyst.co.uk/privacy
`;
}

// --- Resend API call ---------------------------------------------------------
async function sendViaResend({ to, firstName, confirmToken, unsubToken }) {
  const confirmUrl = `${SITE}/api/subscribe/confirm?t=${confirmToken}`;
  const unsubscribeUrl = `${SITE}/api/subscribe/unsubscribe?t=${unsubToken}`;

  const body = {
    from: FROM,
    to: [to],
    reply_to: REPLY_TO,
    subject: SUBJECT,
    html: renderHtml({ firstName, confirmUrl, unsubscribeUrl }),
    text: renderText({ firstName, confirmUrl, unsubscribeUrl }),
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>, <${UNSUB_MAILTO}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };

  const response = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${responseBody}`);
  }
  let parsed;
  try { parsed = JSON.parse(responseBody); } catch { parsed = { raw: responseBody }; }
  return parsed;
}

// --- Main handler ------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const adminPassword = req.headers['x-admin-password'];
  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const body = req.body ?? {};
  const dryRun = body.dry_run === true;
  const testEmails = Array.isArray(body.test_emails) ? body.test_emails.map(e => String(e).toLowerCase()) : null;
  const limit = typeof body.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 2500) : DEFAULT_LIMIT;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Query pending rows that have NOT yet had repermission_sent logged.
    // Supabase can't join-exclude elegantly from a single call, so we fetch
    // candidates + recent events, and filter in code.
    let candidateQuery = supabase
      .from('subscribers')
      .select('id, email, first_name, confirm_token, unsubscribe_token')
      .eq('status', 'pending_confirmation')
      .eq('import_batch', 'repermission_2026_04')
      .not('confirm_token', 'is', null);

    if (testEmails) {
      candidateQuery = candidateQuery.in('email', testEmails);
    }

    candidateQuery = candidateQuery.limit(limit + 100); // buffer for dedup

    const { data: candidates, error: candidatesErr } = await candidateQuery;
    if (candidatesErr) {
      return res.status(500).json({
        error: 'Candidate query failed',
        detail: candidatesErr.message,
      });
    }
    if (!candidates || candidates.length === 0) {
      return res.status(200).json({
        success: true,
        dry_run: dryRun,
        test_mode: !!testEmails,
        counts: { to_send: 0, sent: 0, errors: 0 },
        has_more: false,
        note: 'No pending candidates found.',
      });
    }

    // Exclude any that already have a repermission_sent event
    const candidateIds = candidates.map(c => c.id);
    const { data: alreadySent, error: sentErr } = await supabase
      .from('subscription_events')
      .select('subscriber_id')
      .in('subscriber_id', candidateIds)
      .eq('event_type', 'repermission_sent');

    if (sentErr) {
      return res.status(500).json({
        error: 'Event lookup failed',
        detail: sentErr.message,
      });
    }

    const alreadySentSet = new Set((alreadySent ?? []).map(r => r.subscriber_id));
    const toSend = candidates
      .filter(c => !alreadySentSet.has(c.id))
      .slice(0, limit);

    // Check test_emails requested but not found
    const missingTestEmails = [];
    if (testEmails) {
      const foundEmails = new Set(toSend.map(s => s.email));
      for (const requested of testEmails) {
        if (!foundEmails.has(requested)) missingTestEmails.push(requested);
      }
    }

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dry_run: true,
        test_mode: !!testEmails,
        counts: {
          to_send: toSend.length,
          sent: 0,
          errors: 0,
        },
        would_send_to: toSend.slice(0, 20).map(s => s.email),
        would_send_to_truncated: toSend.length > 20,
        missing_test_emails: missingTestEmails,
        has_more: false,
        note: 'Dry run — no emails sent.',
      });
    }

    // Send, in parallel batches
    let sent = 0;
    let errors = 0;
    const errorDetails = [];

    for (let i = 0; i < toSend.length; i += SEND_PARALLELISM) {
      const chunk = toSend.slice(i, i + SEND_PARALLELISM);
      const results = await Promise.all(chunk.map(async (row) => {
        try {
          const resp = await sendViaResend({
            to: row.email,
            firstName: row.first_name,
            confirmToken: row.confirm_token,
            unsubToken: row.unsubscribe_token,
          });
          return { ok: true, row, resend_id: resp.id };
        } catch (e) {
          return { ok: false, row, error: e.message };
        }
      }));

      // Log repermission_sent events for successful sends
      const eventsToInsert = [];
      for (const result of results) {
        if (result.ok) {
          sent++;
          eventsToInsert.push({
            subscriber_id: result.row.id,
            event_type: 'repermission_sent',
            metadata: {
              batch: 'repermission_2026_04',
              resend_id: result.resend_id ?? null,
            },
          });
        } else {
          errors++;
          errorDetails.push({ email: result.row.email, detail: result.error });
        }
      }
      if (eventsToInsert.length > 0) {
        const { error: evErr } = await supabase
          .from('subscription_events')
          .insert(eventsToInsert);
        if (evErr) {
          console.error('Event log failed for chunk:', evErr);
        }
      }

      // Pause between batches to stay under rate limits
      if (i + SEND_PARALLELISM < toSend.length) {
        await new Promise(r => setTimeout(r, TICK_MS));
      }
    }

    // Check if more remain after this batch (only meaningful for non-test runs)
    let hasMore = false;
    if (!testEmails) {
      const { count: remaining } = await supabase
        .from('subscribers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_confirmation')
        .eq('import_batch', 'repermission_2026_04')
        .not('confirm_token', 'is', null);
      // Rough estimate of remaining-to-send (not exact as we'd need the event join again)
      hasMore = (remaining ?? 0) > sent;
    }

    return res.status(200).json({
      success: errors === 0,
      dry_run: false,
      test_mode: !!testEmails,
      counts: {
        to_send: toSend.length,
        sent,
        errors,
      },
      errors: errorDetails.slice(0, 20),
      errors_truncated: errorDetails.length > 20,
      missing_test_emails: missingTestEmails,
      has_more: hasMore,
    });
  } catch (e) {
    console.error('send-repermission exception:', e);
    return res.status(500).json({ error: 'Server error', detail: e.message });
  }
}
