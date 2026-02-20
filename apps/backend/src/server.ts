import http from 'http';
import https from 'https';
import fs from 'fs';
import type { Server as HttpServer } from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './middleware/logger';
import { prisma } from './db/prisma';
import { startServiceStatusCron } from './services/serviceStatus';
import { startSecurityTokenCleanupCron } from './services/securityTokens';
import { syncStripePlanOverridesFromEnv } from './services/billing';
import { closeRedisClient } from './services/redis';
import { closeNodeServer, createLifecycleController, type ShutdownReason } from './lifecycle/lifecycleController';

let server: HttpServer | null = null;
let stopServiceStatusCron: (() => void) | null = null;
let stopSecurityTokenCleanupCron: (() => void) | null = null;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const shutdownTimeoutMs = parsePositiveInt(process.env.SHUTDOWN_TIMEOUT_MS, 15000);

const lifecycle = createLifecycleController({
  logger,
  timeoutMs: shutdownTimeoutMs,
  closeServer: () => closeNodeServer(server),
  stopBackgroundTasks: () => {
    if (stopServiceStatusCron) stopServiceStatusCron();
    if (stopSecurityTokenCleanupCron) stopSecurityTokenCleanupCron();
  },
  closePrisma: () => prisma.$disconnect(),
  closeRedis: () => closeRedisClient()
});

function buildHttpServer(): HttpServer {
  if (env.httpsEnabled && env.httpsCertPath && env.httpsKeyPath) {
    const options = {
      key: fs.readFileSync(env.httpsKeyPath),
      cert: fs.readFileSync(env.httpsCertPath)
    };
    return https.createServer(options, app);
  }
  return http.createServer(app);
}

async function requestShutdown(reason: ShutdownReason, exitCode: number): Promise<void> {
  await lifecycle.shutdown(reason, exitCode);
  process.exit(exitCode);
}

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    await syncStripePlanOverridesFromEnv();

    server = buildHttpServer();
    server.listen(env.port, () => {
      logger.info({ port: env.port, https: env.httpsEnabled }, 'API listening');
    });

    stopServiceStatusCron = startServiceStatusCron();
    stopSecurityTokenCleanupCron = startSecurityTokenCleanupCron();
  } catch (error) {
    logger.error({ error }, 'Failed to start API');
    await requestShutdown('STARTUP_FAILURE', 1);
  }
}

void start();

process.on('SIGINT', () => {
  void requestShutdown('SIGINT', 0);
});

process.on('SIGTERM', () => {
  void requestShutdown('SIGTERM', 0);
});

process.on('unhandledRejection', (error) => {
  logger.error({ error }, 'Unhandled promise rejection');
  void requestShutdown('UNHANDLED_REJECTION', 1);
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  void requestShutdown('UNCAUGHT_EXCEPTION', 1);
});
