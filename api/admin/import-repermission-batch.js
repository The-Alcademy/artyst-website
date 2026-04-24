// ============================================================================
// api/admin/import-repermission-batch.js
// ----------------------------------------------------------------------------
// One-shot import for the April 2026 re-permission batch. Loads the pre-built
// list of 2,024 historical email contacts into the subscribers table as
// pending_confirmation, ready for the re-permission send.
//
// Protected by ADMIN_PASSWORD. Idempotent — safe to re-run.
// The data JSON is imported and bundled into the function at build time; it
// is never served as a public static file.
//
// Trigger:
//   curl -X POST https://theartyst.co.uk/api/admin/import-repermission-batch \
//     -H "x-admin-password: $ADMIN_PASSWORD" \
//     -H "content-type: application/json" \
//     -d '{"dry_run": true}'
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import batch from './subscribers-batch-2026-04.json' with { type: 'json' };

// Token validity window — 6 weeks from import gives recipients until mid-June
// to confirm. Silent-removal cron on 1 June sweeps the rest.
const TOKEN_EXPIRY_DAYS = 42;

export default async function handler(req, res) {
  // ---- Method & auth ------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const adminPassword = req.headers['x-admin-password'];
  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ---- Config -------------------------------------------------------------
  const body = req.body ?? {};
  const dryRun = body.dry_run === true;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ---- Counters -----------------------------------------------------------
  const counts = {
    total: batch.records.length,
    inserted: 0,
    re_permissioned: 0,
    skipped_confirmed: 0,
    skipped_unsubscribed: 0,
    errors: 0,
  };
  const errors = [];

  const expiresAt = new Date(
    Date.now() + TOKEN_EXPIRY_DAYS * 86400000
  ).toISOString();

  // ---- Process each record ------------------------------------------------
  for (const record of batch.records) {
    const { email, first_name, provenance } = record;

    try {
      const { data: existing, error: lookupErr } = await supabase
        .from('subscribers')
        .select('id, status')
        .eq('email', email)
        .maybeSingle();
      if (lookupErr) throw new Error(`lookup: ${lookupErr.message}`);

      if (existing?.status === 'confirmed') {
        counts.skipped_confirmed++;
        continue;
      }
      if (existing?.status === 'unsubscribed') {
        counts.skipped_unsubscribed++;
        continue;
      }

      if (dryRun) {
        if (existing) counts.re_permissioned++;
        else counts.inserted++;
        continue;
      }

      const confirmToken = randomUUID();

      if (existing) {
        const { error: updateErr } = await supabase
          .from('subscribers')
          .update({
            status: 'pending_confirmation',
            confirm_token: confirmToken,
            confirm_token_expires_at: expiresAt,
            import_batch: batch.batch_id,
            first_name: first_name ?? undefined,
          })
          .eq('id', existing.id);
        if (updateErr) throw new Error(`update: ${updateErr.message}`);

        await supabase.from('subscription_events').insert({
          subscriber_id: existing.id,
          event_type: 'imported',
          metadata: { batch: batch.batch_id, reimport: true, provenance },
        });
        counts.re_permissioned++;
      } else {
        const { data: created, error: insertErr } = await supabase
          .from('subscribers')
          .insert({
            email,
            first_name,
            name: first_name ?? null,
            status: 'pending_confirmation',
            confirm_token: confirmToken,
            confirm_token_expires_at: expiresAt,
            source: batch.batch_id,
            import_batch: batch.batch_id,
            notify_email: true,
            notify_whatsapp: false,
          })
          .select('id')
          .single();
        if (insertErr) throw new Error(`insert: ${insertErr.message}`);

        if (created) {
          await supabase.from('subscription_events').insert({
            subscriber_id: created.id,
            event_type: 'imported',
            metadata: { batch: batch.batch_id, new_row: true, provenance },
          });
        }
        counts.inserted++;
      }
    } catch (e) {
      counts.errors++;
      errors.push({ email, detail: e.message });
    }
  }

  return res.status(200).json({
    success: counts.errors === 0,
    dry_run: dryRun,
    batch_id: batch.batch_id,
    counts,
    errors: errors.slice(0, 20),
    errors_truncated: errors.length > 20,
    total_errors: errors.length,
  });
}
