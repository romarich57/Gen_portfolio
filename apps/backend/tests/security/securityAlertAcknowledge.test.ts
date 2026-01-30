import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';

import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { generateRandomToken, hashToken } from '../../src/utils/crypto';


test('acknowledge security alert token', async () => {
  const user = await prisma.user.create({
    data: {
      email: 'ack@test.com',
      status: 'active',
      emailVerifiedAt: new Date(),
      roles: ['user']
    }
  });

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  await prisma.securityActionToken.create({
    data: {
      userId: user.id,
      action: 'ACK_ALERT',
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    }
  });

  const res = await request(app)
    .get(`/auth/security/acknowledge-alert?token=${encodeURIComponent(rawToken)}`)
    .set('Origin', 'http://localhost:3000');

  assert.equal(res.status, 200);

  const updated = await prisma.securityActionToken.findUnique({ where: { tokenHash } });
  assert.ok(updated?.usedAt);
});
