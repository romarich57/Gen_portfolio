import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { resetOtpRateLimitBuckets } from '../../src/middleware/otpRateLimit';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return { token: res.body.csrfToken as string };
}

test('otp phone start rate limit blocks after threshold', async () => {
  resetOtpRateLimitBuckets();

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);
  const email = `otp-${Date.now()}@example.com`;

  const registerRes = await agent
    .post('/auth/register')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({
      email,
      password: 'StrongPassw0rd!',
      firstName: 'Otp',
      lastName: 'User',
      username: `otp-${Date.now()}`,
      nationality: 'FR'
    });

  assert.equal(registerRes.status, 201);
  const emailToken = registerRes.body.test_token as string;
  assert.ok(emailToken);

  const verifyRes = await agent
    .get(`/auth/email/verify?token=${encodeURIComponent(emailToken)}`)
    .set('Origin', 'http://localhost:3000');
  assert.equal(verifyRes.status, 200);

  const { token: loginCsrf } = await getCsrf(agent);
  const loginRes = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', loginCsrf)
    .send({ identifier: email, password: 'StrongPassw0rd!' });
  assert.equal(loginRes.status, 200);

  const { token: phoneCsrf } = await getCsrf(agent);

  const validPhone = '+14155552671';
  const first = await agent
    .post('/auth/phone/start')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', phoneCsrf)
    .send({ phoneE164: validPhone });
  assert.equal(first.status, 200);

  const second = await agent
    .post('/auth/phone/start')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', phoneCsrf)
    .send({ phoneE164: validPhone });
  assert.equal(second.status, 200);

  const blocked = await agent
    .post('/auth/phone/start')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', phoneCsrf)
    .send({ phoneE164: validPhone });

  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'RATE_LIMITED');
  assert.equal(blocked.body.captcha_required, true);
});
