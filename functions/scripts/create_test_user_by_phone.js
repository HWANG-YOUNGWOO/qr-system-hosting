#!/usr/bin/env node
/**
 * Creates test documents for users_by_phone and optionally users/{uid}.
 *
 * Usage examples:
 *  node scripts/create_test_user_by_phone.js --countryCode 48 --phoneNumber 692481995 --displayName "홍길동" --uid test-user-1
 *  node scripts/create_test_user_by_phone.js --phoneE164 +48692481995 --displayName "홍길동" --usersDocId +48692481995 --createUsersDoc
 *  node scripts/create_test_user_by_phone.js --useEmulator --countryCode 48 --phoneNumber 692481995 --displayName "홍길동" --uid test-user-1
 */

const admin = require('firebase-admin');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

const argv = process.argv.slice(2);
const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--phoneE164' && argv[i+1]) { opts.phoneE164 = argv[++i]; }
  else if (a === '--countryCode' && argv[i+1]) { opts.countryCode = argv[++i]; }
  else if (a === '--phoneNumber' && argv[i+1]) { opts.phoneNumber = argv[++i]; }
  else if (a === '--displayName' && argv[i+1]) { opts.displayName = argv[++i]; }
  else if (a === '--uid' && argv[i+1]) { opts.uid = argv[++i]; }
  else if (a === '--usersDocId' && argv[i+1]) { opts.usersDocId = argv[++i]; }
  else if (a === '--createUsersDoc') { opts.createUsersDoc = true; }
  else if (a === '--useEmulator') { opts.useEmulator = true; }
}

if (opts.useEmulator) {
  // Require FIRESTORE_EMULATOR_HOST to be set or default to localhost:8080
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
}

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function makePhoneKeyFromE164(e164) {
  try {
    const pn = parsePhoneNumberFromString(e164);
    if (!pn) return null;
    return `${pn.countryCallingCode}-${pn.nationalNumber}`;
  } catch (e) { return null; }
}

function toE164FromParts(cc, pn) {
  const c = String(cc || '').replace(/\D/g, '');
  const p = String(pn || '').replace(/\D/g, '');
  if (!c || !p) return null;
  return `+${c}${p}`;
}

async function run() {
  if (!opts.phoneE164) {
    if (opts.countryCode && opts.phoneNumber) {
      opts.phoneE164 = toE164FromParts(opts.countryCode, opts.phoneNumber);
    }
  }

  if (!opts.phoneE164 && !(opts.countryCode && opts.phoneNumber)) {
    console.error('Provide either --phoneE164 or both --countryCode and --phoneNumber');
    process.exit(1);
  }

  const phoneE164 = opts.phoneE164;
  const phoneKey = opts.countryCode && opts.phoneNumber ? `${opts.countryCode}-${opts.phoneNumber}` : makePhoneKeyFromE164(phoneE164);
  if (!phoneKey) {
    console.error('Cannot determine phoneKey from inputs');
    process.exit(1);
  }

  const uid = opts.uid || `test-${Date.now()}`;
  const displayName = opts.displayName || 'Test User';

  console.log('Creating users_by_phone doc', phoneKey, '->', { uid, displayName, phoneE164 });
  await db.collection('users_by_phone').doc(phoneKey).set({ uid, displayName, phoneE164, createdAt: Date.now() }, { merge: true });

  if (opts.createUsersDoc) {
    const usersDocId = opts.usersDocId || opts.uid || phoneE164;
    console.log('Creating users doc', usersDocId, '->', { uid, displayName, phoneE164 });
    await db.collection('users').doc(usersDocId).set({ uid, displayName, phoneE164, createdAt: Date.now() }, { merge: true });
  }

  console.log('Done.');
}

run().catch((err) => { console.error('failed', err); process.exit(1); });
