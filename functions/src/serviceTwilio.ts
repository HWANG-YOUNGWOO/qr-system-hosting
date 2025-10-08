import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import Twilio from 'twilio';
import { logError, logStart, logEnd } from './utils/logger';

const secretClient = new SecretManagerServiceClient();

async function getSecret(name: string) {
  const [version] = await secretClient.accessSecretVersion({ name });
  return version.payload?.data?.toString() || '';
}

async function getTwilioConfig(testMode = false) {
  const project = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
  if (!project) throw new Error('GCP project not set');

  const accountSidName = testMode
    ? `projects/${project}/secrets/Test-twilio-Account-SID/versions/latest`
    : `projects/${project}/secrets/twilio-sid/versions/latest`;
  const authTokenName = testMode
    ? `projects/${project}/secrets/Test-twilio-Auth-token/versions/latest`
    : `projects/${project}/secrets/twilio-token/versions/latest`;

  // Service SID (Verify) - allow test variant too (fallback to live if test not present)
  const serviceSidNameLive = `projects/${project}/secrets/twilio-service-sid/versions/latest`;
  const serviceSidNameTest = `projects/${project}/secrets/Test-twilio-service-sid/versions/latest`;

  const names = [accountSidName, authTokenName, testMode ? serviceSidNameTest : serviceSidNameLive, serviceSidNameLive];

  // Try to resolve secrets; the last element is fallback for serviceSid
  const results = await Promise.all(names.map((n) => getSecret(n).catch(() => '')));
  const [accountSid, authToken, serviceSidCandidate, serviceSidFallback] = results;
  const serviceSid = serviceSidCandidate || serviceSidFallback;

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('Twilio secrets not properly configured');
  }

  return { accountSid, authToken, serviceSid };
}

export async function getTwilioClient(testMode = false) {
  try {
    const cfg = await getTwilioConfig(testMode);
    return Twilio(cfg.accountSid, cfg.authToken);
  } catch (err) {
    logError('getTwilioClient', err as Error);
    throw err;
  }
}

/**
 * Send verification code using Twilio Verify Service
 * Returns { sid, status, serviceSid }
 */
export async function sendVerificationCode(phone: string, testMode = false) {
  const func = 'serviceTwilio.sendVerificationCode';
  // Log only last 4 digits for privacy by default.
  const phoneLast4 = String(phone).slice(-4);
  logStart(func, { phoneLast4, testMode });
  try {
    const cfg = await getTwilioConfig(testMode);
    const client = Twilio(cfg.accountSid, cfg.authToken);
    // Twilio expects E.164. We pass the phone through as given; callers should normalize.
    const res = await client.verify.services(cfg.serviceSid).verifications.create({ to: phone, channel: 'sms' });
    logEnd(func, { sid: res.sid, status: res.status });
    return { sid: res.sid, status: res.status, serviceSid: cfg.serviceSid };
  } catch (err) {
    logError(func, err as Error, { phoneLast4 });
    throw err;
  }
}

/**
 * Verify code using Twilio Verify Service
 * Returns { valid: boolean, status }
 */
export async function verifyCode(phone: string, code: string, testMode = false) {
  const func = 'serviceTwilio.verifyCode';
  logStart(func, { phone: phone.slice(-4), testMode });
  try {
    const cfg = await getTwilioConfig(testMode);
    const client = Twilio(cfg.accountSid, cfg.authToken);
    const res = await client.verify.services(cfg.serviceSid).verificationChecks.create({ to: phone, code });
    const valid = res.status === 'approved' || res.status === 'approved';
    logEnd(func, { status: res.status });
    return { valid, status: res.status };
  } catch (err) {
    logError(func, err as Error, { phone: phone.slice(-4) });
    throw err;
  }
}
