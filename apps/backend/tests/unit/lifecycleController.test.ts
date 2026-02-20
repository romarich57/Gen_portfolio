import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLifecycleController } from '../../src/lifecycle/lifecycleController';

const mockLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
  fatal: () => undefined,
  trace: () => undefined,
  child: () => mockLogger
} as any;

test('lifecycle controller is idempotent and executes closers once', async () => {
  let stopCalls = 0;
  let prismaCalls = 0;
  let redisCalls = 0;
  let serverCalls = 0;

  const controller = createLifecycleController({
    logger: mockLogger,
    timeoutMs: 5000,
    stopBackgroundTasks: () => {
      stopCalls += 1;
    },
    closePrisma: async () => {
      prismaCalls += 1;
    },
    closeRedis: async () => {
      redisCalls += 1;
    },
    closeServer: async () => {
      serverCalls += 1;
    }
  });

  await Promise.all([
    controller.shutdown('SIGTERM', 0),
    controller.shutdown('SIGINT', 0),
    controller.shutdown('UNHANDLED_REJECTION', 1)
  ]);

  assert.equal(stopCalls, 1);
  assert.equal(prismaCalls, 1);
  assert.equal(redisCalls, 1);
  assert.equal(serverCalls, 1);
  assert.equal(controller.isShuttingDown(), true);
});
