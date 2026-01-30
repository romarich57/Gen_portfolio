import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';

import {
  refreshServiceStatus,
  setServiceStatusOverrides,
  resetServiceStatusStateForTests
} from '../../src/services/serviceStatus';

afterEach(() => {
  setServiceStatusOverrides(null);
  resetServiceStatusStateForTests();
});

test('service status sends Slack + email alerts when degraded', async () => {
  const emailCalls: Array<{ to: string; subject: string; text: string; html: string }> = [];
  const slackCalls: Array<{ webhook: string; body: string }> = [];

  setServiceStatusOverrides({
    checkSmtp: async () => ({ ok: true, latencyMs: 5 }),
    checkS3: async () => ({ ok: false, latencyMs: 10, error: 'S3_DOWN' }),
    checkRedis: async () => ({ ok: false, latencyMs: 2, error: 'REDIS_DOWN' }),
    sendEmail: async (options) => {
      emailCalls.push(options);
    },
    postSlack: async (webhook, body) => {
      slackCalls.push({ webhook, body });
    },
    alertEmail: 'ops@example.com',
    alertSlackWebhook: 'https://hooks.slack.test/123',
    alertCooldownMinutes: 0,
    nodeEnv: 'test'
  });

  const snapshot = await refreshServiceStatus({ notify: true });
  assert.equal(snapshot.ok, false);
  assert.equal(emailCalls.length, 1);
  assert.equal(slackCalls.length, 1);
  assert.ok(slackCalls[0].body.includes('S3: DOWN'));
  assert.ok(slackCalls[0].body.includes('Redis: DOWN'));
});
