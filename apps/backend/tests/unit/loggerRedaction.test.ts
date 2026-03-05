import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import pino from 'pino';

import '../setupEnv';

import { loggerRedactPaths } from '../../src/middleware/logger';

test('logger redacts confirmation and password confirmation fields', async () => {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    }
  });

  const logger = pino(
    {
      level: 'info',
      timestamp: false,
      redact: {
        paths: [...loggerRedactPaths],
        remove: true
      }
    },
    sink
  );

  const secretConfirmationToken = `ct_${Date.now()}_${Math.random()}`;
  const secretPasswordConfirmation = `pc_${Date.now()}_${Math.random()}`;
  const marker = `logger-redaction-${Date.now()}`;

  logger.info({
    marker,
    req: {
      body: {
        confirmation_token: secretConfirmationToken,
        confirmationToken: secretConfirmationToken,
        password_confirmation: secretPasswordConfirmation,
        passwordConfirmation: secretPasswordConfirmation
      }
    }
  });

  await new Promise((resolve) => sink.end(resolve));

  const output = lines.join('');
  assert.ok(output.includes(marker));
  assert.equal(output.includes(secretConfirmationToken), false);
  assert.equal(output.includes(secretPasswordConfirmation), false);
});
