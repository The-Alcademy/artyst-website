// ============================================================================
// api/subscribe/signup.js
// ----------------------------------------------------------------------------
// Public signup endpoint. Anyone can POST { email, first_name } to this.
// Inserts as pending_confirmation, sends a welcome email with a confirm link,
// and either redirects to /subscribe/check-email (form post) or returns JSON
// (programmatic post).
//
// No password gating — this is the open door. Protections:
//   - Email format validation
//   - Honeypot field ("website" — bots fill, humans don't); silent success if filled
//   - First name length cap (50 chars) to prevent spammy abuse
//   - Idempotency: re-submitting an existing email re-issues a fresh confirm
//     token but doesn't crash. Already-confirmed → friendly redirect.
//
// Rate-limiting is NOT implemented in this version — ship and add if abused.
// Monitor subscription_events for unusual patterns.
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
const NAME_MAX = 50;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

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

// Detect whether request expects JSON response or form redirect.
// Form posts have `accept: text/html, ...`; programmatic posts have `accept: application/json`.
function wantsJson(req) {
  const accept = (req.headers.accept || '').toLowerCase();
  if (accept.includes('application/json') && !accept.includes('text/html')) return true;
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return true;
  return false;
}

function redirectTo(res, path) {
  return res.redirect(303, `${SITE}${path}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body ?? {};
  const email = String(body.email ?? '').trim().toLowerCase();
  const firstNameRaw = body.first_name ? String(body.first_name).trim() : null;
  const firstName = firstNameRaw ? firstNameRaw.slice(0, NAME_MAX) : null;
  const honeypot = body.website ?? '';
  const json = wantsJson(req);

  // Bot honeypot — silently succeed without writing anything
  if (honeypot) {
    if (json) return res.status(200).json({ success: true });
    return redirectTo(res, '/subscribe/check-email');
  }

  // Validation
  if (!EMAIL_RE.test(email)) {
    if (json) return res.status(400).json({ error: 'Invalid email address' });
    return redirectTo(res, '/subscribe/error?reason=invalid_email');
  }
  if (!process.env.RESEND_API_KEY) {
    console.error('signup: RESEND_API_KEY missing');
    if (json) return res.status(500).json({ error: 'Email service not configured' });
    return redirectTo(res, '/subscribe/error?reason=server_error');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data: existing, error: lookupErr } = await supabase
      .from('subscribers')
      .select('id, status, first_name')
      .eq('email', email)
      .maybeSingle();

    if (lookupErr) {
      console.error('signup lookup error:', lookupErr);
      if (json) return res.status(500).json({ error: 'Lookup failed' });
      return redirectTo(res, '/subscribe/error?reason=server_error');
    }

    // Already confirmed — friendly redirect, no second email
    if (existing?.status === 'confirmed') {
      if (json) {
        return res.status(200).json({
          success: true,
          action: 'already_confirmed',
          note: 'This email is already on the list.',
        });
      }
      return redirectTo(res, '/subscribe/already-confirmed');
    }

    // Previously unsubscribed — silently respect the prior choice. Don't tell
    // the bot/spammer/random submitter that this email was previously here.
    // From the user's perspective, they get the same "check your email" page,
    // but no email is sent. If a real human who previously unsubscribed wants
    // to rejoin, they can email privacy@othersyde.co.uk and we can flip them
    // back manually via the admin page (with force=true).
    if (existing?.status === 'unsubscribed') {
      if (json) {
        return res.status(200).json({
          success: true,
          action: 'silent_skip',
          note: 'Submission accepted.',
        });
      }
      return redirectTo(res, '/subscribe/check-email');
    }

    // Insert or update to pending_confirmation
    const confirmToken = randomUUID();
    const expiresAt = new Date(
      Date.now() + TOKEN_EXPIRY_DAYS * 86400000
    ).toISOString();

    let subscriberId;
    let unsubToken;

    if (existing) {
      // Existing pending/bounced — refresh token
      const { error: updateErr } = await supabase
        .from('subscribers')
        .update({
          status: 'pending_confirmation',
          first_name: firstName ?? existing.first_name,
          confirm_token: confirmToken,
          confirm_token_expires_at: expiresAt,
        })
        .eq('id', existing.id);
      if (updateErr) {
        console.error('signup update error:', updateErr);
        if (json) return res.status(500).json({ error: 'Update failed' });
        return redirectTo(res, '/subscribe/error?reason=server_error');
      }
      const { data: refreshed } = await supabase
        .from('subscribers')
        .select('unsubscribe_token')
        .eq('id', existing.id)
        .single();
      subscriberId = existing.id;
      unsubToken = refreshed?.unsubscribe_token;
    } else {
      const { data: created, error: insertErr } = await supabase
        .from('subscribers')
        .insert({
          email,
          first_name: firstName,
          name: firstName,
          status: 'pending_confirmation',
          confirm_token: confirmToken,
          confirm_token_expires_at: expiresAt,
          source: 'public_signup',
          import_batch: 'public_signup',
          notify_email: true,
          notify_whatsapp: false,
        })
        .select('id, unsubscribe_token')
        .single();

      if (insertErr) {
        console.error('signup insert error:', insertErr);
        if (json) return res.status(500).json({ error: 'Insert failed' });
        return redirectTo(res, '/subscribe/error?reason=server_error');
      }
      subscriberId = created.id;
      unsubToken = created.unsubscribe_token;
    }

    // Log imported event
    await supabase.from('subscription_events').insert({
      subscriber_id: subscriberId,
      event_type: 'imported',
      metadata: {
        public_signup: true,
        new_row: !existing,
        previous_status: existing?.status ?? null,
      },
    });

    // Send welcome email
    let emailError = null;
    try {
      const resp = await sendWelcomeEmail({
        email,
        firstName,
        confirmToken,
        unsubToken,
      });
      await supabase.from('subscription_events').insert({
        subscriber_id: subscriberId,
        event_type: 'repermission_sent',
        metadata: {
          public_signup: true,
          welcome_email: true,
          resend_id: resp?.id ?? null,
        },
      });
    } catch (e) {
      emailError = e.message;
      console.error('signup email send failed:', emailError);
    }

    if (json) {
      return res.status(200).json({
        success: !emailError,
        action: existing ? 'updated_pending' : 'inserted_pending',
        email_sent: !emailError,
        email_error: emailError,
      });
    }

    if (emailError) {
      return redirectTo(res, '/subscribe/error?reason=server_error');
    }
    return redirectTo(res, '/subscribe/check-email');
  } catch (e) {
    console.error('signup handler exception:', e);
    if (json) return res.status(500).json({ error: 'Server error', detail: e.message });
    return redirectTo(res, '/subscribe/error?reason=server_error');
  }
}
