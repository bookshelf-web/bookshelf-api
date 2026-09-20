import pino from 'pino';
import { env } from '../config/env';

/**
 * Structured JSON logger. Every line carries a `context` (the bounded context that
 * produced it) and, for request-scoped logs, the `requestId`, so an error can be
 * traced to a module and to one request without reading through unrelated output.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: { service: 'bookshelf-api' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password'],
    censor: '[redacted]',
  },
});

export type ContextName = 'platform' | 'identity' | 'library' | 'audit' | 'catalog' | 'marketplace' | 'payments';

export const contextLogger = (context: ContextName) => logger.child({ context });
