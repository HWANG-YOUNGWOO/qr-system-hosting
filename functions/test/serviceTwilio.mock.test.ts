import { getTwilioClient, sendVerificationCode, verifyCode } from '../src/serviceTwilio';

describe('serviceTwilio env fallback', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('exports are available and env fallback works', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    process.env.TWILIO_AUTH_TOKEN = 'authtokenplaceholder';
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VAXXXXXXXXXXXXXXXX';

    // Should not throw when creating client from env vars
    const client = await getTwilioClient(true);
    expect(typeof client).toBe('object');
    expect(typeof sendVerificationCode).toBe('function');
    expect(typeof verifyCode).toBe('function');
  });
});
