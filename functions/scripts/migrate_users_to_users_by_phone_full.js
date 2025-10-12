#!/usr/bin/env node
/**
 * Full migration script: migrate all `users` documents into `users_by_phone` mappings.
 * Features:
 *  - Pagination (safe for large collections)
 *  - Dry-run by default; `--apply` to write
 *  - `--force` to overwrite existing mappings
 *  - `--startAfter <docId>` to resume from a given user doc id
 *  - `--limit <N>` to process only N users (useful for testing)
 *  - `--batchSize <N>` commit batch size (<= 500)
 *  - `--pageSize <N>` Firestore page size (<= 500)
 *  - `--exportCsv <path>` export mapping candidates to CSV
 *
 * Usage examples:
 *  # dry-run for whole collection
 *  node scripts/migrate_users_to_users_by_phone_full.js
 *
 *  # apply changes with force and export CSV
 *  node scripts/migrate_users_to_users_by_phone_full.js --apply --force --exportCsv out.csv
 *
 * Note: ensure GOOGLE_APPLICATION_CREDENTIALS or ADC is configured.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

// Simple argv parsing
const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--apply') opts.apply = true;
  else if (a === '--force') opts.force = true;
  else if (a === '--startAfter' && args[i + 1]) { opts.startAfter = args[i + 1]; i++; }
  else if (a === '--limit' && args[i + 1]) { opts.limit = parseInt(args[i + 1], 10); i++; }
  else if (a === '--batchSize' && args[i + 1]) { opts.batchSize = parseInt(args[i + 1], 10); i++; }
  else if (a === '--pageSize' && args[i + 1]) { opts.pageSize = parseInt(args[i + 1], 10); i++; }
  else if (a === '--exportCsv' && args[i + 1]) { opts.exportCsv = args[i + 1]; i++; }
}

const DRY_RUN = !opts.apply;
const FORCE = !!opts.force;
const START_AFTER = opts.startAfter || null;
const LIMIT = opts.limit || null;
const BATCH_SIZE = Math.min(opts.batchSize || 400, 500);
const PAGE_SIZE = Math.min(opts.pageSize || 500, 500);

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function derivePhoneE164FromData(data, docId) {
  if (!data) return null;
  if (data.phoneE164 && typeof data.phoneE164 === 'string' && data.phoneE164.startsWith('+')) return data.phoneE164;
  if (data.phone && typeof data.phone === 'string' && data.phone.startsWith('+')) return data.phone;
  if (data.phoneNumber && data.countryCode) {
    const cc = String(data.countryCode).replace(/\D/g, '');
    const pn = String(data.phoneNumber).replace(/\D/g, '');
    if (cc && pn) return `+${cc}${pn}`;
  }
  if (typeof docId === 'string' && docId.startsWith('+')) return docId;
  if (data.phoneNumber && typeof data.phoneNumber === 'string' && data.phoneNumber.startsWith('+')) return data.phoneNumber;
  return null;
}

function makePhoneKey(e164) {
  try {
    const pn = parsePhoneNumberFromString(e164);
    if (!pn) return null;
    return `${pn.countryCallingCode}-${pn.nationalNumber}`;
  } catch (e) {
    return null;
  }
}

async function processBatch(ops) {
  if (!ops.length) return;
  const batch = db.batch();
  for (const op of ops) {
    batch.set(op.ref, op.data, { merge: true });
  }
  await batch.commit();
}

async function run() {
  console.log('migration start', { DRY_RUN, FORCE, START_AFTER, LIMIT, BATCH_SIZE, PAGE_SIZE, exportCsv: opts.exportCsv });

  let processed = 0;
  let created = 0;
  let skipped = 0;
  let lastDocId = START_AFTER;
  let exportStream = null;
  if (opts.exportCsv) {
    const outPath = path.resolve(opts.exportCsv);
    exportStream = fs.createWriteStream(outPath, { flags: 'w' });
    exportStream.write('userDocId,phoneE164,phoneKey,uid,action\n');
  }

  let ops = [];

  while (true) {
    let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastDocId) q = q.startAfter(lastDocId);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const docId = doc.id;
      if (LIMIT && processed >= LIMIT) break;
      const data = doc.data() || {};
      const phoneE164 = derivePhoneE164FromData(data, docId);
      if (!phoneE164) {
        skipped++;
        processed++;
        lastDocId = docId;
        continue;
      }
      const phoneKey = makePhoneKey(phoneE164);
      if (!phoneKey) {
        skipped++;
        processed++;
        lastDocId = docId;
        continue;
      }

      const phoneDocRef = db.collection('users_by_phone').doc(phoneKey);
      const existing = await phoneDocRef.get();
      if (existing.exists && !FORCE) {
        // skip
        if (exportStream) exportStream.write(`${docId},${phoneE164},${phoneKey},${existing.data()?.uid || ''},skipped_exists\n`);
        skipped++;
        processed++;
        lastDocId = docId;
        continue;
      }

      const setData = { createdAt: Date.now() };
      if (data.displayName) setData.displayName = data.displayName;
      if (data.uid && typeof data.uid === 'string') setData.uid = data.uid;
      else if (!docId.startsWith('+')) setData.uid = docId;

      if (exportStream) exportStream.write(`${docId},${phoneE164},${phoneKey},${setData.uid || ''},${DRY_RUN ? 'dry' : 'write'}\n`);

      if (!DRY_RUN) {
        ops.push({ ref: phoneDocRef, data: setData });
        if (ops.length >= BATCH_SIZE) {
          await processBatch(ops);
          created += ops.length;
          ops = [];
        }
      } else {
        created++;
      }

      processed++;
      lastDocId = docId;
    }

    if (LIMIT && processed >= LIMIT) break;
    // if snap.size < PAGE_SIZE, we've reached the end
    if (snap.size < PAGE_SIZE) break;
  }

  if (!DRY_RUN && ops.length) {
    await processBatch(ops);
    created += ops.length;
  }

  if (exportStream) {
    exportStream.end();
    console.log('Exported CSV to', path.resolve(opts.exportCsv));
  }

  console.log('migration summary', { processed, created, skipped });
}

run().catch((err) => {
  console.error('migration failed', err);
  process.exit(1);
});
