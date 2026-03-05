import pino from 'pino';
import pinoHttp from 'pino-http';
import type { IncomingMessage } from 'http';
import { env } from '../config/env';

const loggerRedactPaths = Object.freeze([
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'req.body.password',
  'req.body.new_password',
  'req.body.newPassword',
  'req.body.password_confirmation',
  'req.body.passwordConfirmation',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.confirmation_token',
  'req.body.confirmationToken',
  'req.body.otp',
  'req.body.code',
  'req.body.captchaToken',
  'req.body.backupCode'
]);

const logger = pino({
  level: env.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [...loggerRedactPaths],
    remove: true
  }
});

function stripQuery(url?: string): string | undefined {
  if (!url) return undefined;
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  customLogLevel: (res, err) => {
    const statusCode = res.statusCode ?? 0;
    if (err || statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req: IncomingMessage & { id?: string; ip?: string }) => ({
      id: req.id,
      method: req.method,
      url: stripQuery(req.url),
      remoteAddress: req.ip,
      userAgent: req.headers['user-agent']
    })
  }
});

export { logger, httpLogger, loggerRedactPaths };
