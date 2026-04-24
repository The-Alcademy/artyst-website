// ============================================================================
// api/admin/import-repermission-batch.js
// ----------------------------------------------------------------------------
// One-shot import for the April 2026 re-permission batch. Loads the pre-built
// list of 2,024 historical email contacts into the subscribers table as
// pending_confirmation, ready for the re-permission send.
//
// Protected by ADMIN_PASSWORD. Idempotent — safe to re-run.
// The data JSON is bundled into the function at build time (not publicly
// served).
//
// Uses bulk operations (batched SELECT / INSERT / UPDATE) to stay well within
// Vercel function timeout limits even on Hobby plan — total runtime for 2,024
// records should be a few seconds, not minutes.
//
// Trigger:
//   curl -X POST https://<domain>/api/admin/import-repermission-batch \
//     -H "x-admin-password: $ADMIN_PASSWORD" \
//     -H "content-type: application/json" \
//     -d '{"dry_run": true}'
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import batch from './subscribers-batch-2026-04.json' with { type: 'json' };

// Token validity window — 6 weeks. Silent-removal cron on 1 June sweeps the rest.
const TOKEN_EXPIRY_DAYS = 42;

// Chunk sizes — keep requests under Supabase REST API payload/URL limits
const LOOKUP_CHUNK = 200;   // IN() clause chunk for SELECT
const INSERT_CHUNK = 500;   // Bulk INSERT chunk
const UPDATE_CHUNK = 50;    // Parallel UPDATEs per chunk
const EVENT_CHUNK = 500;    // Bulk INSERT for audit events

export default async function handler(req, res) {
  // ---- Method & auth ------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const adminPassword = req.headers['x-admin-password'];
  if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body ?? {};
  const dryRun = body.dry_run === true;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const records = batch.records;
  const allEmails = records.map(r => r.email);

  try {
    // ----------------------------------------------------------------------
    // Step 1: Bulk lookup — find all existing subscribers among our batch
    // ----------------------------------------------------------------------
    const existingByEmail = new Map();

    for (let i = 0; i < allEmails.length; i += LOOKUP_CHUNK) {
      const chunk = allEmails.slice(i, i + LOOKUP_CHUNK);
      const { data, error } = await supabase
        .from('subscribers')
        .select('id, email, status')
        .in('email', chunk);

      if (error) {
        return res.status(500).json({
          error: 'Lookup failed',
          stage: 'lookup',
          detail: error.message,
        });
      }
      for (const row of data ?? []) {
        existingByEmail.set(row.email, row);
      }
    }

    // ----------------------------------------------------------------------
    // Step 2: Categorize each record in memory
    // ----------------------------------------------------------------------
    const toInsert = [];
    const toRepermission = [];
    let skippedConfirmed = 0;
    let skippedUnsubscribed = 0;

    for (const record of records) {
      const existing = existingByEmail.get(record.email);
      if (!existing) {
        toInsert.push(record);
      } else if (existing.status === 'confirmed') {
        skippedConfirmed++;
      } else if (existing.status === 'unsubscribed') {
        skippedUnsubscribed++;
      } else {
        toRepermission.push({ ...record, _existingId: existing.id });
      }
    }

    // ----------------------------------------------------------------------
    // Step 3: Dry-run returns counts and stops
    // ----------------------------------------------------------------------
    if (dryRun) {
      return res.status(200).json({
        success: true,
        dry_run: true,
        batch_id: batch.batch_id,
        counts: {
          total: records.length,
          inserted: toInsert.length,
          re_permissioned: toRepermission.length,
          skipped_confirmed: skippedConfirmed,
          skipped_unsubscribed: skippedUnsubscribed,
          errors: 0,
        },
        note: 'Dry run — no changes written.',
      });
    }

    // ----------------------------------------------------------------------
    // Step 4: Bulk INSERT new rows (chunked)
    // ----------------------------------------------------------------------
    const expiresAt = new Date(
      Date.now() + TOKEN_EXPIRY_DAYS * 86400000
    ).toISOString();

    const insertRows = toInsert.map(r => ({
      email: r.email,
      first_name: r.first_name,
      name: r.first_name ?? null,
      status: 'pending_confirmation',
      confirm_token: randomUUID(),
      confirm_token_expires_at: expiresAt,
      source: batch.batch_id,
      import_batch: batch.batch_id,
      notify_email: true,
      notify_whatsapp: false,
    }));

    const insertedIds = [];
    for (let i = 0; i < insertRows.length; i += INSERT_CHUNK) {
      const chunk = insertRows.slice(i, i + INSERT_CHUNK);
      const { data, error } = await supabase
        .from('subscribers')
        .insert(chunk)
        .select('id, email');

      if (error) {
        return res.status(500).json({
          error: 'Insert failed',
          stage: 'insert',
          chunk_index: i,
          chunk_size: chunk.length,
          detail: error.message,
          partial_inserted: insertedIds.length,
        });
      }
      for (const row of data ?? []) {
        insertedIds.push({ id: row.id, email: row.email });
      }
    }

    // ----------------------------------------------------------------------
    // Step 5: UPDATE re-permissioned rows (parallel in chunks)
    // ----------------------------------------------------------------------
    const updatedIds = [];
    const updateErrors = [];

    for (let i = 0; i < toRepermission.length; i += UPDATE_CHUNK) {
      const chunk = toRepermission.slice(i, i + UPDATE_CHUNK);
      const results = await Promise.all(
        chunk.map(async (r) => {
          const { error } = await supabase
            .from('subscribers')
            .update({
              status: 'pending_confirmation',
              confirm_token: randomUUID(),
              confirm_token_expires_at: expiresAt,
              import_batch: batch.batch_id,
              first_name: r.first_name ?? undefined,
            })
            .eq('id', r._existingId);
          return { id: r._existingId, email: r.email, error };
        })
      );
      for (const result of results) {
        if (result.error) {
          updateErrors.push({ email: result.email, detail: result.error.message });
        } else {
          updatedIds.push(result.id);
        }
      }
    }

    // ----------------------------------------------------------------------
    // Step 6: Bulk INSERT audit events
    // ----------------------------------------------------------------------
    const events = [
      ...insertedIds.map(r => ({
        subscriber_id: r.id,
        event_type: 'imported',
        metadata: { batch: batch.batch_id, new_row: true },
      })),
      ...updatedIds.map(id => ({
        subscriber_id: id,
        event_type: 'imported',
        metadata: { batch: batch.batch_id, reimport: true },
      })),
    ];

    let eventsLogged = 0;
    for (let i = 0; i < events.length; i += EVENT_CHUNK) {
      const chunk = events.slice(i, i + EVENT_CHUNK);
      const { error } = await supabase.from('subscription_events').insert(chunk);
      if (error) {
        console.error('Event log chunk failed:', error);
      } else {
        eventsLogged += chunk.length;
      }
    }

    return res.status(200).json({
      success: updateErrors.length === 0,
      dry_run: false,
      batch_id: batch.batch_id,
      counts: {
        total: records.length,
        inserted: insertedIds.length,
        re_permissioned: updatedIds.length,
        skipped_confirmed: skippedConfirmed,
        skipped_unsubscribed: skippedUnsubscribed,
        errors: updateErrors.length,
      },
      events_logged: eventsLogged,
      errors: updateErrors.slice(0, 20),
      errors_truncated: updateErrors.length > 20,
      total_errors: updateErrors.length,
    });
  } catch (e) {
    console.error('Import handler exception:', e);
    return res.status(500).json({
      error: 'Server error',
      detail: e.message,
    });
  }
}
