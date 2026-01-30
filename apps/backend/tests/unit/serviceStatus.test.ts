import test from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';

import {
  refreshServiceStatus,
  getServiceStatusSnapshot,
  getServiceStatusHistory,
  ensureServiceStatusFresh,
  startServiceStatusCron
} from '../../src/services/serviceStatus';

test('refreshServiceStatus populates snapshot and history', async () => {
  const snapshot = await refreshServiceStatus({ notify: false });
  assert.equal(snapshot.ok, true);
  assert.ok(snapshot.checkedAt instanceof Date);

  const stored = getServiceStatusSnapshot();
  assert.ok(stored);
  assert.equal(stored?.ok, true);

  const history = getServiceStatusHistory();
  assert.ok(history.length >= 1);
});

test('ensureServiceStatusFresh returns cached snapshot', async () => {
  const first = await refreshServiceStatus({ notify: false });
  const cached = await ensureServiceStatusFresh(60_000);
  assert.equal(cached.ok, first.ok);
});

test('getServiceStatusHistory respects limit', async () => {
  await refreshServiceStatus({ notify: false });
  await refreshServiceStatus({ notify: false });
  const limited = getServiceStatusHistory(1);
  assert.equal(limited.length, 1);
});

test('startServiceStatusCron is disabled in test env', () => {
  const stop = startServiceStatusCron();
  assert.equal(stop, null);
});
