import https from 'https';
import fs from 'fs';
import { app } from './app';
import { env } from './config/env';
import { logger } from './middleware/logger';
import { prisma } from './db/prisma';
import { startServiceStatusCron } from './services/serviceStatus';
import { startSecurityTokenCleanupCron } from './services/securityTokens';

let stopServiceStatusCron: (() => void) | null = null;
let stopSecurityTokenCleanupCron: (() => void) | null = null;

async function start(): Promise<void> {
  try {
    await prisma.$connect();

    if (env.httpsEnabled && env.httpsCertPath && env.httpsKeyPath) {
      const options = {
        key: fs.readFileSync(env.httpsKeyPath),
        cert: fs.readFileSync(env.httpsCertPath)
      };
      https.createServer(options, app).listen(env.port, () => {
        logger.info({ port: env.port, https: true }, 'API listening (HTTPS)');
      });
    } else {
      app.listen(env.port, () => {
        logger.info({ port: env.port, https: false }, 'API listening (HTTP)');
      });
    }

    stopServiceStatusCron = startServiceStatusCron();
    stopSecurityTokenCleanupCron = startSecurityTokenCleanupCron();
  } catch (error) {
    logger.error({ error }, 'Failed to start API');
    process.exit(1);
  }
}

void start();

process.on('SIGINT', async () => {
  if (stopServiceStatusCron) {
    stopServiceStatusCron();
  }
  if (stopSecurityTokenCleanupCron) {
    stopSecurityTokenCleanupCron();
  }
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (stopServiceStatusCron) {
    stopServiceStatusCron();
  }
  if (stopSecurityTokenCleanupCron) {
    stopSecurityTokenCleanupCron();
  }
  await prisma.$disconnect();
  process.exit(0);
});
