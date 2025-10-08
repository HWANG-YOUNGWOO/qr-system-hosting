import { setTimeout } from 'timers/promises';
import admin from 'firebase-admin';

// If a Firestore emulator is present, point the admin SDK at it.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  // Default emulator host used in this workspace when running emulators locally
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

// initialize admin SDK to write seed data when running against emulator
try {
  admin.initializeApp({ projectId: 'unlock-system-f31d9' });
} catch (e) {
  // ignore if already initialized
}
const db = admin.firestore();

// Usage: node sendOtpStressTest.mjs --concurrency 10 --requests 50 --countryCode 82 --phoneNumber 1012345678 --testMode true

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [k, v] = arg.split('=');
  if (v === undefined) return [k.replace(/^--/, ''), 'true'];
  return [k.replace(/^--/, ''), v];
}));

const concurrency = Number(args.concurrency || 10);
const totalRequests = Number(args.requests || 50);
const countryCode = args.countryCode || '82';
const phoneNumber = args.phoneNumber || '1012345678';
const testMode = args.testMode === 'true' || args.testMode === true;

const projectId = 'unlock-system-f31d9';
// allow overriding functions emulator port via CLI arg --functionsPort=5002 or env FIREBASE_FUNCTIONS_PORT
const functionsPort = Number(args.functionsPort || process.env.FIREBASE_FUNCTIONS_PORT || process.env.FUNCTIONS_EMULATOR_PORT || 5002);
const url = `http://127.0.0.1:${functionsPort}/${projectId}/us-central1/sendOtp`;

console.log({ concurrency, totalRequests, countryCode, phoneNumber, url, testMode });

// Seed the 'users_by_phone' doc so sendOtp will hit the OTP code path instead of 'notRegistered'.
try {
  // First try REST API to emulator (more robust when admin SDK isn't initialized against emulator)
  const docPath = `projects/${'unlock-system-f31d9'}/databases/(default)/documents/users_by_phone/${encodeURIComponent(`${countryCode}-${phoneNumber}`)}`;
  const restUrl = `http://127.0.0.1:8080/emulator/v1/${docPath}`;
  try {
    const restBody = { fields: { uid: { stringValue: 'test-uid' }, displayName: { stringValue: 'Test User' }, seededAt: { integerValue: String(Date.now()) } } };
    const seedRes = await fetch(restUrl, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(restBody) });
    console.log('REST seed HTTP status', seedRes.status, 'url', restUrl);
    const seedText = await seedRes.text().catch(()=>null);
    console.log('REST seed response body', seedText);
    if (seedRes.ok) {
      console.log('seeded users_by_phone via REST for', `${countryCode}-${phoneNumber}`);
    } else {
      console.warn('REST seed failed, http status', seedRes.status);
      // fallback to admin SDK write
      await db.collection('users_by_phone').doc(`${countryCode}-${phoneNumber}`).set({ uid: 'test-uid', displayName: 'Test User', seededAt: Date.now() });
      console.log('seeded users_by_phone via admin SDK for', `${countryCode}-${phoneNumber}`);
    }
  } catch (e) {
    // fallback to admin SDK write
    await db.collection('users_by_phone').doc(`${countryCode}-${phoneNumber}`).set({ uid: 'test-uid', displayName: 'Test User', seededAt: Date.now() });
    console.log('seeded users_by_phone via admin SDK for', `${countryCode}-${phoneNumber}`, 'after REST error', String(e));
  }
} catch (err) {
  console.warn('failed to seed users_by_phone', String(err));
}

async function sendOne(i) {
  const body = { data: { countryCode, phoneNumber, testModeFlag: testMode } };
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    const ms = Date.now() - start;
    return { ok: true, status: res.status, body: json, ms };
  } catch (err) {
    const ms = Date.now() - start;
    return { ok: false, err: String(err), ms };
  }
}

async function worker(id, count, results) {
  for (let i = 0; i < count; i++) {
    const r = await sendOne(i);
    const entry = { workerId: id, seq: i, res: r };
    results.push(entry);
    // per-request JSON line for easier parsing
    console.log(JSON.stringify(entry));
    // small jitter
    await setTimeout(Math.random() * 50);
  }
}

(async () => {
  const perWorker = Math.ceil(totalRequests / concurrency);
  const results = [];
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker(i, perWorker, results));
  }
  const start = Date.now();
  await Promise.all(workers);
  const duration = Date.now() - start;

  const ok = results.filter(r => r.res.ok).length;
  const failed = results.filter(r => !r.res.ok).length;
  const rateLimited = results.filter(r => r.res.ok && r.res.body && r.res.body.messageKey === 'auth.rateLimited').length;
  const attemptIds = results.filter(r => r.res.ok && r.res.body && r.res.body.attemptId).length;
  const latencies = results.filter(r => r.res.ok).map(r => r.res.ms);
  const avg = latencies.reduce((a,b)=>a+b,0)/Math.max(1,latencies.length);

  console.log('---RESULTS---');
  console.log('totalSent:', results.length);
  console.log('ok:', ok, 'failed:', failed, 'rateLimited:', rateLimited, 'attemptIds:', attemptIds);
  console.log('duration(ms):', duration, 'avg latency(ms):', Math.round(avg));
  process.exit(0);
})();
