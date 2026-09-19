import { randomUUID } from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import pinoHttp from 'pino-http';
import { ContextName, logger } from './logger';

const REQUEST_ID_HEADER = 'x-request-id';
// Accept an id from an upstream proxy only if it is short and printable.
const SAFE_REQUEST_ID = /^[\w.-]{8,64}$/;

/** Assigns a request id (echoed in the `X-Request-Id` response header) and logs each request. */
export const requestLogger: RequestHandler = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customProps: (_req, res) => ({ context: (res as Response).locals?.context ?? 'platform' }),
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Health checks are noise in the logs.
  autoLogging: { ignore: req => req.url === '/health' },
});

/**
 * Tags everything that happens under a router with its bounded context, both in the
 * request logger and in error responses.
 */
export const withContext =
  (context: ContextName): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    res.locals.context = context;
    req.log = req.log.child({ context });
    next();
  };
