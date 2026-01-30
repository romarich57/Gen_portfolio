import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { generateRandomToken, hashToken } from '../../src/utils/crypto';

async function createSession(userId: string) {
  const rawRefresh = generateRandomToken(32);
  const refreshHash = hashToken(rawRefresh);
  return prisma.session.create({
    data: {
      userId,
      refreshTokenHash: refreshHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ip: '127.0.0.1',
      userAgent: 'test-agent'
    }
  });
}

test('revoke all sessions from security alert token', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'alert@test.com',
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user']
    }
  });

  const session = await createSession(user.id);

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  await prisma.securityActionToken.create({
    data: {
      userId: user.id,
      action: 'REVOKE_SESSIONS',
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    }
  });

  const res = await request(app)
    .get(`/auth/security/revoke-sessions?token=${encodeURIComponent(rawToken)}`)
    .set('Origin', 'http://localhost:3000');

  assert.equal(res.status, 200);

  const updatedSession = await prisma.session.findUnique({ where: { id: session.id } });
  assert.ok(updatedSession?.revokedAt);

  const updatedToken = await prisma.securityActionToken.findUnique({ where: { tokenHash } });
  assert.ok(updatedToken?.usedAt);
});
