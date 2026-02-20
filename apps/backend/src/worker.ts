import { prisma } from './db/prisma';
import { logger } from './middleware/logger';
import { closeRedisClient } from './services/redis';
import { runNextJob } from './services/jobs';
import { createLifecycleController, type ShutdownReason } from './lifecycle/lifecycleController';

const DEFAULT_IDLE_SLEEP_MS = 1500;
const DEFAULT_BUSY_SLEEP_MS = 150;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const idleSleepMs = parsePositiveInt(process.env.WORKER_IDLE_SLEEP_MS, DEFAULT_IDLE_SLEEP_MS);
const busySleepMs = parsePositiveInt(process.env.WORKER_BUSY_SLEEP_MS, DEFAULT_BUSY_SLEEP_MS);
const shutdownTimeoutMs = parsePositiveInt(process.env.SHUTDOWN_TIMEOUT_MS, 15000);
const runOnceOnly = process.env.WORKER_ONCE === 'true';
const workerId = process.env.WORKER_ID || `worker-${process.pid}`;

let shouldStop = false;

const lifecycle = createLifecycleController({
  logger,
  timeoutMs: shutdownTimeoutMs,
  stopBackgroundTasks: () => {
    shouldStop = true;
  },
  closePrisma: () => prisma.$disconnect(),
  closeRedis: () => closeRedisClient()
});

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestShutdown(reason: ShutdownReason, exitCode: number): Promise<void> {
  await lifecycle.shutdown(reason, exitCode);
  process.exit(exitCode);
}

async function processLoop(): Promise<void> {
  await prisma.$connect();
  logger.info(
    {
      workerId,
      idleSleepMs,
      busySleepMs,
      runOnceOnly
    },
    'GDPR worker started'
  );

  while (!shouldStop) {
    const job = await runNextJob(workerId);
    if (job) {
      logger.debug({ workerId, jobId: job.id, type: job.type }, 'Worker processed job');
    }

    if (runOnceOnly) break;
    await sleep(job ? busySleepMs : idleSleepMs);
  }

  logger.info({ workerId }, 'GDPR worker stopping');
  await requestShutdown('SIGTERM', 0);
}

void processLoop().catch(async (error) => {
  logger.error({ error, workerId }, 'GDPR worker crashed');
  await requestShutdown('STARTUP_FAILURE', 1);
});

process.on('SIGINT', () => {
  void requestShutdown('SIGINT', 0);
});

process.on('SIGTERM', () => {
  void requestShutdown('SIGTERM', 0);
});

process.on('unhandledRejection', (error) => {
  logger.error({ error, workerId }, 'Worker unhandled promise rejection');
  void requestShutdown('UNHANDLED_REJECTION', 1);
});

process.on('uncaughtException', (error) => {
  logger.error({ error, workerId }, 'Worker uncaught exception');
  void requestShutdown('UNCAUGHT_EXCEPTION', 1);
});
