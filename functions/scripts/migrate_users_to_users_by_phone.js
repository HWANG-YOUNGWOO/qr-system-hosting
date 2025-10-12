#!/usr/bin/env node
/**
 * Migration script: create `users_by_phone` documents from existing `users` collection.
 *
 * Usage:
 *   # dry run (default)
 *   node scripts/migrate_users_to_users_by_phone.js
 *
 *   # actually write mappings (use with caution)
 *   node scripts/migrate_users_to_users_by_phone.js --apply --force
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON with
 * Firestore write access, or run in an environment with Application Default Credentials.
 */

const admin = require('firebase-admin');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

// Simple argv parsing to avoid new dependencies
const rawArgs = process.argv.slice(2);
const argv = {};
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--apply') argv.apply = true;
  else if (a === '--force') argv.force = true;
  else if (a === '--limit' && rawArgs[i + 1]) { argv.limit = rawArgs[i + 1]; i++; }
  else if (a === '--batchSize' && rawArgs[i + 1]) { argv.batchSize = rawArgs[i + 1]; i++; }
}
const DRY_RUN = !argv.apply;
const FORCE = !!argv.force;
const LIMIT = argv.limit ? parseInt(argv.limit, 10) : null;
const BATCH_SIZE = argv.batchSize ? parseInt(argv.batchSize, 10) : 400; // keep under 500

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

async function getUsers(limit) {
  let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId());
  if (limit) q = q.limit(limit);
  const snap = await q.get();
  return snap.docs;
}

function derivePhoneE164FromDoc(doc) {
  const data = doc.data() || {};
  // common field names: phoneE164, phone, phoneNumber, countryCode + phoneNumber, or doc id
  if (data.phoneE164 && typeof data.phoneE164 === 'string' && data.phoneE164.startsWith('+')) return data.phoneE164;
  if (data.phone && typeof data.phone === 'string' && data.phone.startsWith('+')) return data.phone;
  if (data.phoneNumber && data.countryCode) {
    // toE164-like: ensure digits
    const cc = String(data.countryCode).replace(/\D/g, '');
    const pn = String(data.phoneNumber).replace(/\D/g, '');
    if (cc && pn) return `+${cc}${pn}`;
  }
  if (doc.id && typeof doc.id === 'string' && doc.id.startsWith('+')) return doc.id;
  // fallback: if phoneNumber field looks like +...
  if (data.phoneNumber && typeof data.phoneNumber === 'string' && data.phoneNumber.startsWith('+')) return data.phoneNumber;
  return null;
}

function makePhoneKeyFromPhoneNumber(e164) {
  try {
    const pn = parsePhoneNumberFromString(e164);
    if (!pn || !pn.countryCallingCode || !pn.nationalNumber) return null;
    return `${pn.countryCallingCode}-${pn.nationalNumber}`;
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log('Migration start', { DRY_RUN, FORCE, LIMIT, BATCH_SIZE });
  const docs = await getUsers(LIMIT);
  console.log(`Found ${docs.length} user docs to inspect`);

  let created = 0;
  let skipped = 0;
  const batchOps = [];

  for (const doc of docs) {
    const uid = doc.id;
    const data = doc.data() || {};
    const phoneE164 = derivePhoneE164FromDoc(doc);
    if (!phoneE164) {
      console.log(`skip: no phone for user ${uid}`);
      skipped++;
      continue;
    }
    const phoneKey = makePhoneKeyFromPhoneNumber(phoneE164);
    if (!phoneKey) {
      console.log(`skip: cannot parse phone ${phoneE164} for user ${uid}`);
      skipped++;
      continue;
    }
    const phoneDocRef = db.collection('users_by_phone').doc(phoneKey);
    // fetch existing mapping
    const existing = await phoneDocRef.get();
    if (existing.exists && !FORCE) {
      console.log(`exists: ${phoneKey} -> skipping (use --force to overwrite)`);
      skipped++;
      continue;
    }

    const setData = { createdAt: Date.now() };
    if (data.displayName) setData.displayName = data.displayName;
    // if user doc includes explicit uid or references, prefer that
    if (data.uid && typeof data.uid === 'string') {
      setData.uid = data.uid;
    } else {
      // use the user doc id as uid if it looks like an auto-id (non +E.164)
      if (!uid.startsWith('+')) setData.uid = uid;
    }

    console.log(`${DRY_RUN ? '[DRY]' : '[WRITE]'} mapping ${phoneKey} -> uid=${setData.uid || '<none>'} (source user=${uid})`);
    if (!DRY_RUN) {
      batchOps.push({ ref: phoneDocRef, data: setData });
      if (batchOps.length >= BATCH_SIZE) {
        await flushBatch(batchOps);
        batchOps.length = 0;
      }
    }
    created++;
  }

  if (!DRY_RUN && batchOps.length) {
    await flushBatch(batchOps);
  }

  console.log('Migration done', { created, skipped });
}

async function flushBatch(ops) {
  const batch = db.batch();
  for (const op of ops) batch.set(op.ref, op.data, { merge: true });
  await batch.commit();
  console.log(`Committed batch of ${ops.length} mappings`);
}

run().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
