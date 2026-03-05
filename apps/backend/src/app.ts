import express from 'express';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestId } from './middleware/requestId';
import { httpLogger } from './middleware/logger';
import { helmetMiddleware, permissionsPolicy } from './middleware/securityHeaders';
import { corsMiddleware } from './middleware/cors';
import { csrfProtection } from './middleware/csrf';
import { adminApiLimiter, globalLimiter } from './middleware/rateLimit';
import { attachTestUser } from './middleware/testAuth';
import { errorHandler } from './middleware/errorHandler';
import { onboardingGate } from './middleware/onboardingGate';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { protectedRouter } from './routes/protected';
import { testRouter } from './routes/test';
import { adminRouter } from './routes/admin';
import { adminApiRouter } from './routes/adminApi';
import { billingRouter } from './routes/billing';
import { webhookRouter } from './routes/webhooks';
import { meRouter } from './routes/me';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.trustProxy);

app.use(requestId);
app.use(httpLogger);
app.use(helmetMiddleware);
app.use(permissionsPolicy);
app.use(corsMiddleware);
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));
const jsonParser = express.json({ limit: '100kb' });
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/webhooks/stripe')) return next();
  return jsonParser(req, res, next);
});
app.use(cookieParser(env.cookieSigningSecret));
app.use(attachTestUser);
app.use(globalLimiter);
app.use(csrfProtection);

app.use('/health', healthRouter);
app.use('/api/health', healthRouter);
app.use('/auth', authRouter);
app.use('/api/admin', adminApiRouter);
app.use(onboardingGate);
app.use('/me', meRouter);
app.use('/protected', protectedRouter);
app.use('/admin', adminApiLimiter, adminRouter);
app.use('/billing', billingRouter);
app.use('/webhooks', webhookRouter);

if (env.isTest) {
  app.use('/_test', testRouter);
}

app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    request_id: req.id
  });
});

app.use(errorHandler);

export { app };
