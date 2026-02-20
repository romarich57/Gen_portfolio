import type { Server as HttpServer } from 'http';
import type { Logger } from 'pino';

export type ShutdownReason =
  | 'SIGINT'
  | 'SIGTERM'
  | 'UNHANDLED_REJECTION'
  | 'UNCAUGHT_EXCEPTION'
  | 'STARTUP_FAILURE';

type LifecycleControllerOptions = {
  logger: Logger;
  timeoutMs: number;
  closeServer?: () => Promise<void>;
  stopBackgroundTasks?: () => Promise<void> | void;
  closePrisma?: () => Promise<void>;
  closeRedis?: () => Promise<void>;
};

export type LifecycleController = {
  shutdown: (reason: ShutdownReason, exitCode: number) => Promise<void>;
  isShuttingDown: () => boolean;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (timeoutMs <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}_TIMEOUT`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function closeHttpServer(closeServer: (() => Promise<void>) | undefined): Promise<void> {
  if (!closeServer) return;
  await closeServer();
}

export function createLifecycleController(options: LifecycleControllerOptions): LifecycleController {
  let shutdownPromise: Promise<void> | null = null;
  let shuttingDown = false;

  const shutdown = async (reason: ShutdownReason, exitCode: number): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;

    shutdownPromise = (async () => {
      options.logger.warn({ reason, exitCode }, 'Graceful shutdown started');

      try {
        await Promise.resolve(options.stopBackgroundTasks?.());
      } catch (error) {
        options.logger.warn({ error }, 'Failed to stop background tasks');
      }

      await Promise.allSettled([
        withTimeout(closeHttpServer(options.closeServer), options.timeoutMs, 'SERVER_CLOSE'),
        withTimeout(Promise.resolve(options.closePrisma?.()), options.timeoutMs, 'PRISMA_CLOSE'),
        withTimeout(Promise.resolve(options.closeRedis?.()), options.timeoutMs, 'REDIS_CLOSE')
      ]);

      options.logger.info({ reason, exitCode }, 'Graceful shutdown completed');
    })();

    return shutdownPromise;
  };

  return {
    shutdown,
    isShuttingDown: () => shuttingDown
  };
}

export async function closeNodeServer(server: HttpServer | null): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
