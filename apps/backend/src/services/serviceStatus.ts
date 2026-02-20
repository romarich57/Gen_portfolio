import { env } from '../config/env';
import { logger } from '../middleware/logger';
import { checkSmtpConnection, sendEmail } from './email';
import { checkS3Connection } from './s3';
import { checkRedisConnection } from './redis';
import { prisma } from '../db/prisma';
import { JobStatus } from '@prisma/client';

export type ServiceCheck = {
  ok: boolean;
  latencyMs: number | null;
  error?: string | null;
};

export type QueueServiceCheck = ServiceCheck & {
  queuedOverdue: number;
  runningStale: number;
};

export type ServiceStatusSnapshot = {
  ok: boolean;
  checkedAt: Date;
  services: {
    smtp: ServiceCheck;
    s3: ServiceCheck;
    redis: ServiceCheck;
    queue: QueueServiceCheck;
  };
};

type AlertState = 'ok' | 'degraded';

let lastSnapshot: ServiceStatusSnapshot | null = null;
let lastAlertAt = 0;
let lastAlertState: AlertState | null = null;
let cronHandle: NodeJS.Timeout | null = null;
const history: ServiceStatusSnapshot[] = [];

type ServiceStatusOverrides = {
  checkSmtp?: () => Promise<ServiceCheck>;
  checkS3?: () => Promise<ServiceCheck>;
  checkRedis?: () => Promise<ServiceCheck>;
  checkQueue?: () => Promise<QueueServiceCheck>;
  sendEmail?: typeof sendEmail;
  postSlack?: (webhookUrl: string, body: string) => Promise<void>;
  alertEmail?: string | null;
  alertSlackWebhook?: string | null;
  alertCooldownMinutes?: number;
  nodeEnv?: string;
};

let overrides: ServiceStatusOverrides | null = null;

export function setServiceStatusOverrides(next: ServiceStatusOverrides | null) {
  overrides = next;
}

export function resetServiceStatusStateForTests() {
  if (!env.isTest) return;
  lastSnapshot = null;
  lastAlertAt = 0;
  lastAlertState = null;
  history.splice(0, history.length);
}

function formatIssue(label: string, service: ServiceCheck) {
  if (service.ok) return null;
  const error = service.error ? ` (${service.error})` : '';
  return `${label}: DOWN${error}`;
}

const QUEUED_OVERDUE_WINDOW_MS = 5 * 60 * 1000;
const RUNNING_STALE_WINDOW_MS = 15 * 60 * 1000;

async function checkQueueConnection(): Promise<QueueServiceCheck> {
  if (env.isTest) {
    return { ok: true, latencyMs: 0, error: null, queuedOverdue: 0, runningStale: 0 };
  }

  const start = Date.now();
  try {
    const now = new Date();
    const queuedThreshold = new Date(now.getTime() - QUEUED_OVERDUE_WINDOW_MS);
    const runningThreshold = new Date(now.getTime() - RUNNING_STALE_WINDOW_MS);

    const [queuedOverdue, runningStale] = await Promise.all([
      prisma.job.count({
        where: {
          status: JobStatus.queued,
          runAfter: { lt: queuedThreshold }
        }
      }),
      prisma.job.count({
        where: {
          status: JobStatus.running,
          OR: [
            { lockedAt: null },
            { lockedAt: { lt: runningThreshold } }
          ]
        }
      })
    ]);

    const ok = queuedOverdue === 0 && runningStale === 0;
    const error = ok ? null : `QUEUED_OVERDUE=${queuedOverdue},RUNNING_STALE=${runningStale}`;
    return {
      ok,
      latencyMs: Date.now() - start,
      error,
      queuedOverdue,
      runningStale
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'QUEUE_UNAVAILABLE';
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: message.slice(0, 160),
      queuedOverdue: 0,
      runningStale: 0
    };
  }
}

async function notifyStatusChange(previous: ServiceStatusSnapshot | null, current: ServiceStatusSnapshot) {
  const alertEmail = overrides?.alertEmail ?? env.serviceStatusAlertEmail;
  const alertSlackWebhook = overrides?.alertSlackWebhook ?? env.serviceStatusAlertSlackWebhook;
  const alertCooldownMinutes = overrides?.alertCooldownMinutes ?? env.serviceStatusAlertCooldownMinutes;
  const nodeEnv = overrides?.nodeEnv ?? env.nodeEnv;
  const hasAlertChannel = Boolean(alertEmail || alertSlackWebhook);
  if (!hasAlertChannel) return;

  if (!previous && current.ok) {
    return;
  }

  const nextState: AlertState = current.ok ? 'ok' : 'degraded';
  if (previous && previous.ok === current.ok) {
    return;
  }

  const now = Date.now();
  const cooldownMs = alertCooldownMinutes * 60 * 1000;
  if (now - lastAlertAt < cooldownMs && lastAlertState === nextState) {
    return;
  }

  const issues = [
    formatIssue('SMTP', current.services.smtp),
    formatIssue('S3', current.services.s3),
    formatIssue('Redis', current.services.redis),
    formatIssue('Queue', current.services.queue)
  ].filter(Boolean);

  const subjectPrefix = current.ok ? 'RECOVERY' : 'ALERT';
  const subject = `[${nodeEnv}] ${subjectPrefix} - Service status`;
  const summary = current.ok ? 'All services are healthy.' : issues.join(' | ');
  const body = [
    `Environment: ${nodeEnv}`,
    `Status: ${current.ok ? 'OK' : 'DEGRADED'}`,
    `Checked at: ${current.checkedAt.toISOString()}`,
    summary ? `Details: ${summary}` : null
  ]
    .filter(Boolean)
    .join('\n');

  const postSlack = overrides?.postSlack ?? (async (webhookUrl: string, text: string) => {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
  });

  if (alertSlackWebhook) {
    try {
      await postSlack(alertSlackWebhook, body);
    } catch (error) {
      logger.warn({ error }, 'Failed to send Slack service alert');
    }
  }

  const sendEmailFn = overrides?.sendEmail ?? sendEmail;
  if (alertEmail) {
    if (!current.services.smtp.ok) {
      logger.warn('Skipping email alert because SMTP is unavailable');
    } else {
      try {
        await sendEmailFn({
          to: alertEmail,
          subject,
          text: body,
          html: `<pre>${body}</pre>`
        });
      } catch (error) {
        logger.warn({ error }, 'Failed to send email service alert');
      }
    }
  }

  lastAlertAt = now;
  lastAlertState = nextState;
}

export async function refreshServiceStatus(options: { notify?: boolean } = {}) {
  const checkSmtp = overrides?.checkSmtp ?? checkSmtpConnection;
  const checkS3 = overrides?.checkS3 ?? checkS3Connection;
  const checkRedis = overrides?.checkRedis ?? checkRedisConnection;
  const checkQueue = overrides?.checkQueue ?? checkQueueConnection;

  const [smtp, s3, redis, queue] = await Promise.all([checkSmtp(), checkS3(), checkRedis(), checkQueue()]);
  const snapshot: ServiceStatusSnapshot = {
    ok: smtp.ok && s3.ok && redis.ok && queue.ok,
    checkedAt: new Date(),
    services: {
      smtp: { ok: smtp.ok, latencyMs: smtp.latencyMs ?? null, error: smtp.error ?? null },
      s3: { ok: s3.ok, latencyMs: s3.latencyMs ?? null, error: s3.error ?? null },
      redis: { ok: redis.ok, latencyMs: redis.latencyMs ?? null, error: redis.error ?? null },
      queue: {
        ok: queue.ok,
        latencyMs: queue.latencyMs ?? null,
        error: queue.error ?? null,
        queuedOverdue: queue.queuedOverdue ?? 0,
        runningStale: queue.runningStale ?? 0
      }
    }
  };

  const previous = lastSnapshot;
  lastSnapshot = snapshot;
  history.push(snapshot);
  if (history.length > env.serviceStatusHistoryLimit) {
    history.splice(0, history.length - env.serviceStatusHistoryLimit);
  }

  if (options.notify) {
    await notifyStatusChange(previous, snapshot);
  }

  return snapshot;
}

export function getServiceStatusSnapshot() {
  return lastSnapshot;
}

export function getServiceStatusHistory(limit?: number) {
  const items = history.slice();
  const normalizedLimit = limit && limit > 0 ? limit : env.serviceStatusHistoryLimit;
  if (items.length <= normalizedLimit) {
    return items;
  }
  return items.slice(items.length - normalizedLimit);
}

export async function ensureServiceStatusFresh(maxAgeMs: number) {
  if (!lastSnapshot) {
    return refreshServiceStatus({ notify: false });
  }
  const age = Date.now() - lastSnapshot.checkedAt.getTime();
  if (age > maxAgeMs) {
    return refreshServiceStatus({ notify: false });
  }
  return lastSnapshot;
}

export function startServiceStatusCron() {
  if (env.isTest || !env.serviceStatusCronEnabled) return null;

  const intervalMs = env.serviceStatusCronIntervalSeconds * 1000;
  if (cronHandle) {
    clearInterval(cronHandle);
  }

  const tick = async () => {
    try {
      await refreshServiceStatus({ notify: true });
    } catch (error) {
      logger.warn({ error }, 'Service status cron failed');
    }
  };

  void tick();
  cronHandle = setInterval(tick, intervalMs);
  return () => {
    if (cronHandle) {
      clearInterval(cronHandle);
      cronHandle = null;
    }
  };
}
