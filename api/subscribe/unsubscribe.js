// ============================================================================
// api/subscribe/unsubscribe.js
// ----------------------------------------------------------------------------
// Handles one-click unsubscribe. The unsubscribe_token is persistent — never
// cleared — so this endpoint is always addressable.
//
// Supports GET (human click) and POST (mailer one-click per RFC 8058).
//
// URL:   GET  /api/subscribe/unsubscribe?t={uuid}
//        POST /api/subscribe/unsubscribe  body: { t: "{uuid}" }
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SITE = process.env.PUBLIC_SITE_URL || 'https://theartyst.co.uk';

function redirectToError(res, reason) {
  return res.redirect(302, `${SITE}/subscribe/error?reason=${reason}`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token =
    req.method === 'GET'
      ? req.query.t
      : req.body?.t ?? req.query.t;

  if (!token || typeof token !== 'string') {
    if (req.method === 'POST') {
      return res.status(400).json({ error: 'missing_token' });
    }
    return redirectToError(res, 'missing_token');
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: sub, error: lookupErr } = await supabase
      .from('subscribers')
      .select('id, status')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (lookupErr) {
      console.error('unsubscribe lookup error:', lookupErr);
      if (req.method === 'POST') return res.status(500).json({ error: 'server_error' });
      return redirectToError(res, 'server_error');
    }

    if (!sub) {
      if (req.method === 'POST') return res.status(404).json({ error: 'invalid_token' });
      return redirectToError(res, 'invalid_token');
    }

    if (sub.status === 'unsubscribed') {
      if (req.method === 'POST') {
        return res.status(200).json({ ok: true, already_unsubscribed: true });
      }
      return res.redirect(302, `${SITE}/subscribe/unsubscribed`);
    }

    await supabase.from('subscription_events').insert({
      subscriber_id: sub.id,
      event_type: 'unsubscribe_clicked',
    });

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('subscribers')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: now,
        confirm_token: null,
        confirm_token_expires_at: null,
      })
      .eq('id', sub.id);

    if (updateErr) {
      console.error('unsubscribe update error:', updateErr);
      if (req.method === 'POST') return res.status(500).json({ error: 'server_error' });
      return redirectToError(res, 'server_error');
    }

    await supabase.from('subscription_events').insert({
      subscriber_id: sub.id,
      event_type: 'unsubscribed',
    });

    if (req.method === 'POST') return res.status(200).json({ ok: true });
    return res.redirect(302, `${SITE}/subscribe/unsubscribed`);
  } catch (e) {
    console.error('unsubscribe handler exception:', e);
    if (req.method === 'POST') return res.status(500).json({ error: 'server_error' });
    return redirectToError(res, 'server_error');
  }
}
