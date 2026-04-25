// ============================================================================
// api/admin/add-subscriber.js
// ----------------------------------------------------------------------------
// Admin endpoint to manually add a single subscriber. Powers the form at
// /admin/subscribers. Protected by ADMIN_PASSWORD.
//
// Two modes:
//   mode: "opt_in"    — insert as pending_confirmation, send welcome email
//                       with confirm link (double opt-in, GDPR-safest).
//   mode: "confirmed" — insert as confirmed directly. For in-venue walk-ins
//                       who verbally consented. No email sent. Subscriber
//                       becomes immediately active.
//
// Idempotency:
//   - Already-confirmed email: no-op, returns existing row
//   - Pending-confirmation email: updates with fresh token (if opt_in mode)
//                                 or promotes to confirmed (if confirmed mode)
//   - Previously-unsubscribed email: returns 409 conflict unless force=true
//   - Previously-bounced email: returns 409 conflict unless force=true
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SITE = process.env.PUBLIC_SITE_URL || 'https://artyst-website.vercel.app';
const RESEND_API = 'https://api.resend.com/emails';

const FROM = 'Matthew Taylor <matthew@theartyst.co.uk>';
const REPLY_TO = 'matthew@othersyde.co.uk';
const UNSUB_MAILTO = 'mailto:privacy@othersyde.co.uk?subject=unsubscribe';
const SUBJECT = 'Please confirm your subscription to The Artyst';

const TOKEN_EXPIRY_DAYS = 42;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ---- Welcome email template (distinct from re-permission) -----------------
function renderWelcomeHtml({ firstName, confirmUrl, unsubscribeUrl }) {
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

  <p style="margin:0 0 16px;font-size:17px;">Thanks for joining The Artyst's email list. To confirm your subscription, please click the button below:</p>

  <p style="margin:24px 0 24px;">
    <a href="${confirmUrl}" style="display:inline-block;background:#1d5c5c;color:#ffffff;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:600;text-decoration:none;border-radius:4px;">→ Confirm my subscription</a>
  </p>

  <p style="margin:0 0 16px;font-size:17px;">You'll receive around one email a fortnight — events at the venue, exhibitions, news from the Invysible College and our Cambridge walking tours. You can unsubscribe at any time using the link at the bottom of every email.</p>

  <p style="margin:0 0 16px;font-size:17px;">If you didn't ask to be added to our list, just ignore this email — you won't hear from us again.</p>

  <hr style="border:none;border-top:1px solid #e5e3dc;margin:32px 0;">

  <p style="margin:0 0 16px;font-size:15px;color:#4a4a4a;">The Artyst is a café, bar and cultural venue at 54–56 Chesterton Road, Cambridge — the only dedicated Syd Barrett heritage venue in the world, operating with the approval of the Barrett and Mick Rock estates.</p>

  <p style="margin:0 0 8px;font-size:17px;">Warmly,</p>
  <p style="margin:0 0 4px;font-size:17px;"><strong>Matthew Taylor</strong></p>
  <p style="margin:0 0 4px;font-size:15px;color:#4a4a4a;">Director, OtherSyde Ltd / The Artyst</p>
  <p style="margin:0 0 32px;font-size:15px;color:#4a4a4a;"><a href="mailto:${REPLY_TO}" style="color:#1d5c5c;">${REPLY_TO}</a> · <a href="https://theartyst.co.uk" style="color:#1d5c5c;">theartyst.co.uk</a></p>

  <p style="margin:32px 0 0;font-size:13px;color:#6a6a6a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <a href="${unsubscribeUrl}" style="color:#6a6a6a;text-decoration:underline;">Unsubscribe immediately</a> ·
    <a href="${SITE}/privacy" style="color:#6a6a6a;text-decoration:underline;">Privacy policy</a>
  </p>
</div>
</body>
</html>`;
}

function renderWelcomeText({ firstName, confirmUrl, unsubscribeUrl }) {
  const name = firstName || 'there';
  return `Hi ${name},

Thanks for joining The Artyst's email list. To confirm your subscription, please click the link below:

${confirmUrl}

You'll receive around one email a fortnight — events at the venue, exhibitions, news from the Invysible College and our Cambridge walking tours. You can unsubscribe at any time using the link at the bottom of every email.

If you didn't ask to be added to our list, just ignore this email — you won't hear from us again.

---

The Artyst is a café, bar and cultural venue at 54-56 Chesterton Road, Cambridge — the only dedicated Syd Barrett heritage venue in the world, operating with the approval of the Barrett and Mick Rock estates.

Warmly,

Matthew Taylor
Director, OtherSyde Ltd / The Artyst
${REPLY_TO} · theartyst.co.uk

Unsubscribe: ${unsubscribeUrl}
Privacy policy: ${SITE}/privacy
`;
}

// ---- Resend send ----------------------------------------------------------
async function sendWelcomeEmail({ email, firstName, confirmToken, unsubToken }) {
  const confirmUrl = `${SITE}/api/subscribe/confirm?t=${confirmToken}`;
  const unsubscribeUrl = `${SITE}/api/subscribe/unsubscribe?t=${unsubToken}`;

  const body = {
    from: FROM,
    to: [email],
    reply_to: REPLY_TO,
    subject: SUBJECT,
    html: renderWelcomeHtml({ firstName, confirmUrl, unsubscribeUrl }),
    text: renderWelcomeText({ firstName, confirmUrl, unsubscribeUrl }),
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

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${responseText}`);
  }
  try { return JSON.parse(responseText); } catch { return { raw: responseText }; }
}

// ---- Main handler ---------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const adminPassword = req.headers['x-admin-password'];
  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body ?? {};
  const email = String(body.email ?? '').trim().toLowerCase();
  const firstName = body.first_name ? String(body.first_name).trim() : null;
  const mode = body.mode;
  const force = body.force === true;

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (mode !== 'opt_in' && mode !== 'confirmed') {
    return res.status(400).json({ error: 'Mode must be "opt_in" or "confirmed"' });
  }
  if (mode === 'opt_in' && !process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Look up existing
    const { data: existing, error: lookupErr } = await supabase
      .from('subscribers')
      .select('id, email, status, first_name, unsubscribed_at, bounced_at, confirmed_at')
      .eq('email', email)
      .maybeSingle();

    if (lookupErr) {
      return res.status(500).json({ error: 'Lookup failed', detail: lookupErr.message });
    }

    // ------------------------------------------------------------------
    // Existing: already confirmed → no-op
    // ------------------------------------------------------------------
    if (existing?.status === 'confirmed') {
      return res.status(200).json({
        success: true,
        action: 'already_confirmed',
        subscriber: {
          id: existing.id,
          email: existing.email,
          first_name: existing.first_name,
          status: existing.status,
          confirmed_at: existing.confirmed_at,
        },
        note: 'This email is already confirmed on the list. No changes made.',
      });
    }

    // ------------------------------------------------------------------
    // Existing: unsubscribed or bounced → require explicit force
    // ------------------------------------------------------------------
    if ((existing?.status === 'unsubscribed' || existing?.status === 'bounced') && !force) {
      return res.status(409).json({
        success: false,
        error: 'conflict',
        existing_status: existing.status,
        unsubscribed_at: existing.unsubscribed_at,
        bounced_at: existing.bounced_at,
        message: `This email previously ${
          existing.status === 'unsubscribed' ? 'unsubscribed' : 'bounced'
        }. Submit again with "Override previous state" ticked to proceed.`,
      });
    }

    // ------------------------------------------------------------------
    // Upsert path
    // ------------------------------------------------------------------
    const now = new Date().toISOString();
    const confirmToken = mode === 'opt_in' ? randomUUID() : null;
    const expiresAt = mode === 'opt_in'
      ? new Date(Date.now() + TOKEN_EXPIRY_DAYS * 86400000).toISOString()
      : null;

    let subscriberId;
    let action;
    let unsubToken;

    if (existing) {
      // Update in place
      const updates = {
        status: mode === 'opt_in' ? 'pending_confirmation' : 'confirmed',
        first_name: firstName ?? existing.first_name,
        confirm_token: confirmToken,
        confirm_token_expires_at: expiresAt,
        confirmed_at: mode === 'confirmed' ? now : null,
        unsubscribed_at: null,
        bounced_at: null,
      };
      const { error: updateErr } = await supabase
        .from('subscribers')
        .update(updates)
        .eq('id', existing.id);
      if (updateErr) {
        return res.status(500).json({ error: 'Update failed', detail: updateErr.message });
      }

      // Re-fetch to get unsubscribe_token (needed for email)
      const { data: refreshed } = await supabase
        .from('subscribers')
        .select('id, unsubscribe_token')
        .eq('id', existing.id)
        .single();

      subscriberId = existing.id;
      unsubToken = refreshed?.unsubscribe_token;
      action = mode === 'opt_in'
        ? 'updated_pending'
        : 'promoted_to_confirmed';
    } else {
      // Brand new row
      const { data: created, error: insertErr } = await supabase
        .from('subscribers')
        .insert({
          email,
          first_name: firstName,
          name: firstName,
          status: mode === 'opt_in' ? 'pending_confirmation' : 'confirmed',
          confirm_token: confirmToken,
          confirm_token_expires_at: expiresAt,
          confirmed_at: mode === 'confirmed' ? now : null,
          source: 'manual_add',
          import_batch: 'manual_add',
          notify_email: true,
          notify_whatsapp: false,
        })
        .select('id, unsubscribe_token')
        .single();

      if (insertErr) {
        return res.status(500).json({ error: 'Insert failed', detail: insertErr.message });
      }
      subscriberId = created.id;
      unsubToken = created.unsubscribe_token;
      action = mode === 'opt_in' ? 'inserted_pending' : 'inserted_confirmed';
    }

    // ------------------------------------------------------------------
    // Log events
    // ------------------------------------------------------------------
    const eventRows = [{
      subscriber_id: subscriberId,
      event_type: 'imported',
      metadata: {
        manual_add: true,
        new_row: !existing,
        previous_status: existing?.status ?? null,
        override: force,
      },
    }];
    if (mode === 'confirmed') {
      eventRows.push({
        subscriber_id: subscriberId,
        event_type: 'confirmed',
        metadata: { manual_add: true, manually_confirmed: true },
      });
    }
    await supabase.from('subscription_events').insert(eventRows);

    // ------------------------------------------------------------------
    // Send welcome email if opt_in
    // ------------------------------------------------------------------
    let emailSent = false;
    let emailError = null;
    if (mode === 'opt_in') {
      try {
        const resp = await sendWelcomeEmail({
          email,
          firstName,
          confirmToken,
          unsubToken,
        });
        emailSent = true;
        await supabase.from('subscription_events').insert({
          subscriber_id: subscriberId,
          event_type: 'repermission_sent',
          metadata: {
            manual_add: true,
            welcome_email: true,
            resend_id: resp?.id ?? null,
          },
        });
      } catch (e) {
        emailError = e.message;
      }
    }

    return res.status(200).json({
      success: true,
      action,
      subscriber: {
        id: subscriberId,
        email,
        first_name: firstName ?? existing?.first_name ?? null,
        status: mode === 'opt_in' ? 'pending_confirmation' : 'confirmed',
      },
      email_sent: emailSent,
      email_error: emailError,
      previous_status: existing?.status ?? null,
    });
  } catch (e) {
    console.error('add-subscriber exception:', e);
    return res.status(500).json({ error: 'Server error', detail: e.message });
  }
}
