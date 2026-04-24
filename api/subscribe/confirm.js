// ============================================================================
// api/subscribe/confirm.js
// ----------------------------------------------------------------------------
// Handles the opt-in click from the re-permission email. Validates the
// single-use confirm_token, marks the subscriber as confirmed, logs the
// event, and redirects to the appropriate public page.
//
// URL:   GET /api/subscribe/confirm?t={uuid}
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SITE = process.env.PUBLIC_SITE_URL || 'https://theartyst.co.uk';

function redirectToError(res, reason) {
  return res.redirect(302, `${SITE}/subscribe/error?reason=${reason}`);
}

export default async function handler(req, res) {
  const token = req.query.t;

  if (!token || typeof token !== 'string') {
    return redirectToError(res, 'missing_token');
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: sub, error: lookupErr } = await supabase
      .from('subscribers')
      .select('id, status, confirm_token_expires_at')
      .eq('confirm_token', token)
      .maybeSingle();

    if (lookupErr) {
      console.error('confirm lookup error:', lookupErr);
      return redirectToError(res, 'server_error');
    }
    if (!sub) return redirectToError(res, 'invalid_token');

    if (sub.status === 'confirmed') {
      return res.redirect(302, `${SITE}/subscribe/already-confirmed`);
    }
    if (sub.status === 'unsubscribed') {
      return redirectToError(res, 'unsubscribed');
    }
    if (sub.status !== 'pending_confirmation') {
      return redirectToError(res, 'invalid_state');
    }

    if (
      sub.confirm_token_expires_at &&
      new Date(sub.confirm_token_expires_at) < new Date()
    ) {
      return redirectToError(res, 'expired');
    }

    await supabase.from('subscription_events').insert({
      subscriber_id: sub.id,
      event_type: 'confirm_clicked',
    });

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('subscribers')
      .update({
        status: 'confirmed',
        confirmed_at: now,
        confirm_token: null,
        confirm_token_expires_at: null,
      })
      .eq('id', sub.id);

    if (updateErr) {
      console.error('confirm update error:', updateErr);
      return redirectToError(res, 'server_error');
    }

    await supabase.from('subscription_events').insert({
      subscriber_id: sub.id,
      event_type: 'confirmed',
    });

    return res.redirect(302, `${SITE}/subscribe/confirmed`);
  } catch (e) {
    console.error('confirm handler exception:', e);
    return redirectToError(res, 'server_error');
  }
}
