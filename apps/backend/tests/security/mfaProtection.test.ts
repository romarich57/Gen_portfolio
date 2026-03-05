import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { hashPassword } from '../../src/utils/password';
import { generateTotpSecret } from '../../src/services/mfa';
import { encryptSecret, generateBackupCode, hashBackupCode } from '../../src/utils/crypto';
import { resetMfaProtectionBuckets } from '../../src/services/mfaProtection';

async function getCsrf(agent: request.SuperTest<request.Test>) {
  const res = await agent.get('/auth/csrf').set('Origin', 'http://localhost:3000');
  return { token: res.body.csrfToken as string };
}

async function createMfaUser(emailPrefix: string) {
  const passwordHash = await hashPassword('StrongPassw0rd!');
  const user = await prisma.user.create({
    data: {
      email: `${emailPrefix}-${Date.now()}@example.com`,
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user'],
      mfaEnabled: true
    }
  });

  const { secret } = generateTotpSecret(user.email);
  await prisma.mfaFactor.create({
    data: {
      userId: user.id,
      type: 'totp',
      secretEncrypted: encryptSecret(secret),
      enabledAt: new Date(),
      lastUsedAt: new Date()
    }
  });

  return user;
}

test('mfa verify enforces adaptive captcha and temporary lockout after repeated failures', async () => {
  resetMfaProtectionBuckets();
  const user = await createMfaUser('mfa-lock');

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const loginRes = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ identifier: user.email, password: 'StrongPassw0rd!' });

  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.error, 'MFA_CHALLENGE_REQUIRED');

  for (let i = 0; i < 3; i += 1) {
    const invalid = await agent
      .post('/auth/mfa/verify')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', token)
      .send({ code: '000000' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'MFA_CODE_INVALID');
  }

  const captchaRequired = await agent
    .post('/auth/mfa/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ code: '000000' });
  assert.equal(captchaRequired.status, 403);
  assert.equal(captchaRequired.body.error, 'CAPTCHA_REQUIRED');

  const fourthFailure = await agent
    .post('/auth/mfa/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ code: '000000', captchaToken: 'test-captcha' });
  assert.equal(fourthFailure.status, 400);
  assert.equal(fourthFailure.body.error, 'MFA_CODE_INVALID');

  const locked = await agent
    .post('/auth/mfa/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ code: '000000', captchaToken: 'test-captcha' });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.error, 'MFA_TEMP_LOCKED');
  assert.equal(locked.body.captcha_required, true);

  const stillLocked = await agent
    .post('/auth/mfa/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ code: '000000', captchaToken: 'test-captcha' });
  assert.equal(stillLocked.status, 429);
  assert.equal(stillLocked.body.error, 'MFA_TEMP_LOCKED');
});

test('mfa verify accepts generated backup code format', async () => {
  resetMfaProtectionBuckets();
  const user = await createMfaUser('mfa-backup');
  const backupCode = generateBackupCode();
  assert.match(backupCode, /^[A-Za-z0-9_-]{11}$/);

  await prisma.backupCode.create({
    data: {
      userId: user.id,
      codeHash: hashBackupCode(backupCode)
    }
  });

  const agent = request.agent(app);
  const { token } = await getCsrf(agent);

  const loginRes = await agent
    .post('/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ identifier: user.email, password: 'StrongPassw0rd!' });

  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.error, 'MFA_CHALLENGE_REQUIRED');

  const verifyRes = await agent
    .post('/auth/mfa/verify')
    .set('Origin', 'http://localhost:3000')
    .set('X-CSRF-Token', token)
    .send({ code: backupCode });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.ok, true);

  const backupEntry = await prisma.backupCode.findFirst({
    where: {
      userId: user.id,
      codeHash: hashBackupCode(backupCode)
    }
  });
  assert.ok(backupEntry?.usedAt);
});
