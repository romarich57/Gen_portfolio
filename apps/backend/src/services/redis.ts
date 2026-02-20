import { createClient, type RedisClientType } from 'redis';
import { env } from '../config/env';
import { logger } from '../middleware/logger';

let client: RedisClientType | null = null;
let connectPromise: Promise<void> | null = null;

function ensureClient(): RedisClientType | null {
  if (!env.redisUrl) return null;
  if (client) return client;

  client = createClient({ url: env.redisUrl });
  client.on('error', (error) => {
    logger.warn({ error }, 'Redis client error');
  });
  connectPromise = client
    .connect()
    .then(() => undefined)
    .catch((error) => {
      logger.error({ error }, 'Redis connect failed');
    })
    .finally(() => {
      connectPromise = null;
    });
  return client;
}

export function getRedisClient(): RedisClientType | null {
  return ensureClient();
}

export async function checkRedisConnection(): Promise<{ ok: boolean; latencyMs: number | null; error?: string }> {
  if (!env.redisUrl) {
    return { ok: true, latencyMs: null };
  }

  const redisClient = ensureClient();
  if (!redisClient) {
    return { ok: false, latencyMs: null, error: 'REDIS_UNAVAILABLE' };
  }

  const start = Date.now();
  try {
    await redisClient.ping();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'REDIS_UNAVAILABLE';
    return { ok: false, latencyMs: Date.now() - start, error: message.slice(0, 160) };
  }
}

export async function closeRedisClient(): Promise<void> {
  if (!client) return;
  try {
    if (connectPromise) {
      await connectPromise;
    }
    await client.quit();
  } catch (error) {
    logger.warn({ error }, 'Redis close failed');
  } finally {
    client = null;
    connectPromise = null;
  }
}
