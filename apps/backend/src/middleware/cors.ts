import cors, { type CorsOptions } from 'cors';
import { env } from '../config/env';

function isOriginAllowed(origin?: string): boolean {
  if (!origin) return false;
  return env.corsOrigins.includes(origin);
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, false);
    if (isOriginAllowed(origin)) return callback(null, true);
    const error = new Error('CORS_ORIGIN_DENIED') as Error & { statusCode?: number };
    error.statusCode = 403;
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600
};

const corsMiddleware = cors(corsOptions);

export { corsMiddleware, isOriginAllowed };
