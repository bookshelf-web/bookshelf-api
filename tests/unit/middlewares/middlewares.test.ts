import { NextFunction, Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { z } from 'zod';
import { authMiddleware } from '../../../src/middlewares/authMiddleware';
import { errorHandler, notFoundHandler } from '../../../src/middlewares/errorHandler';
import { requireRole } from '../../../src/middlewares/requireRole';
import { validate } from '../../../src/middlewares/validate';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../src/shared/errors';
import { signAuthToken } from '../../../src/shared/jwt';
import { Role } from '../../../src/shared/roles';

function mockReq(partial: Partial<Request> = {}): Request {
  return { headers: {}, id: 'req-1', log: { error: jest.fn() }, ...partial } as unknown as Request;
}

function mockRes() {
  const res = {
    locals: {} as Record<string, unknown>,
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as typeof res & Response;
}

describe('authMiddleware', () => {
  const next = jest.fn() as NextFunction;

  it('rejects a request without a token', () => {
    expect(() => authMiddleware(mockReq(), mockRes(), next)).toThrow(UnauthorizedError);
    try {
      authMiddleware(mockReq(), mockRes(), next);
    } catch (error) {
      expect((error as UnauthorizedError).code).toBe('TOKEN_MISSING');
    }
  });

  it.each(['Token abc', 'Bearer', 'abc'])('rejects the malformed header "%s"', header => {
    const req = mockReq({ headers: { authorization: header } });
    try {
      authMiddleware(req, mockRes(), next);
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as UnauthorizedError).code).toBe('TOKEN_MALFORMED');
    }
  });

  it('rejects an invalid token', () => {
    const req = mockReq({ headers: { authorization: 'Bearer nope' } });

    expect(() => authMiddleware(req, mockRes(), next)).toThrow(UnauthorizedError);
  });

  it('exposes the user id and roles on the request', () => {
    const nextFn = jest.fn();
    const req = mockReq({
      headers: { authorization: `Bearer ${signAuthToken('user-9', [Role.BUYER])}` },
    });

    authMiddleware(req, mockRes(), nextFn);

    expect(req.userId).toBe('user-9');
    expect(req.userRoles).toEqual([Role.BUYER]);
    expect(nextFn).toHaveBeenCalledTimes(1);
  });
});

describe('requireRole', () => {
  it('lets through a user with any of the allowed roles', () => {
    const next = jest.fn();
    const req = mockReq({ userRoles: [Role.BUYER] });

    requireRole(Role.SELLER, Role.BUYER)(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks everyone else with ROLE_REQUIRED and lists what is needed', () => {
    const req = mockReq({ userRoles: [Role.READER] });

    try {
      requireRole(Role.ADMIN)(req, mockRes(), jest.fn());
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).code).toBe('ROLE_REQUIRED');
      expect((error as ForbiddenError).details).toEqual({ required: [Role.ADMIN] });
    }
  });

  it('treats a request with no roles as having none', () => {
    expect(() => requireRole(Role.READER)(mockReq(), mockRes(), jest.fn())).toThrow(ForbiddenError);
  });
});

describe('validate', () => {
  it('replaces body, query and params with the parsed values', () => {
    const req = mockReq({ body: { n: '5' }, query: { page: '2' }, params: { id: 'x' } });
    const next = jest.fn();

    validate({
      body: z.object({ n: z.coerce.number() }),
      query: z.object({ page: z.coerce.number() }),
      params: z.object({ id: z.string() }),
    })(req, mockRes(), next);

    expect(req.body).toEqual({ n: 5 });
    expect(req.query).toEqual({ page: 2 });
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a validation error listing every failing field', () => {
    const next = jest.fn();

    validate({ body: z.object({ a: z.string(), b: z.string() }) })(mockReq({ body: {} }), mockRes(), next);

    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.details).toHaveLength(2);
  });

  it('forwards unexpected errors untouched', () => {
    const boom = new Error('boom');
    const schema = z.object({}).transform(() => {
      throw boom;
    });
    const next = jest.fn();

    validate({ body: schema as unknown as z.AnyZodObject })(mockReq({ body: {} }), mockRes(), next);

    expect(next).toHaveBeenCalledWith(boom);
  });
});

describe('errorHandler', () => {
  const run = (error: unknown, res = mockRes(), req = mockReq()) => {
    errorHandler(error, req, res, jest.fn());
    return { res, req, body: res.json.mock.calls[0][0] };
  };

  it('turns an AppError into its status, code and details', () => {
    const { res, body } = run(new NotFoundError('Book not found', 'BOOK_NOT_FOUND'));

    expect(res.status).toHaveBeenCalledWith(404);
    expect(body).toMatchObject({ error: 'Book not found', code: 'BOOK_NOT_FOUND' });
  });

  it('adds the context and request id so the failure can be traced', () => {
    const res = mockRes();
    res.locals.context = 'identity';

    const { body } = run(new ConflictError('dup'), res, mockReq({ id: 'abc-123' } as Partial<Request>));

    expect(body).toMatchObject({ context: 'identity', requestId: 'abc-123' });
  });

  it('falls back to the platform context', () => {
    expect(run(new ConflictError('dup')).body.context).toBe('platform');
  });

  it('converts a ZodError into a 400 validation response', () => {
    const parsed = z.object({ a: z.string() }).safeParse({});
    if (parsed.success) throw new Error('expected failure');

    const { res, body } = run(parsed.error);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('maps a Postgres unique violation to 409', () => {
    const violation = Object.assign(new QueryFailedError('insert', [], new Error('dup')), {
      code: '23505',
    });

    const { res, body } = run(violation);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(body.code).toBe('CONFLICT');
  });

  it('hides unexpected errors behind a 500 and logs them with the request logger', () => {
    const req = mockReq();
    const failure = new Error('secret internals');

    const { res, body } = run(failure, mockRes(), req);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(body).toMatchObject({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(body)).not.toContain('secret internals');
    expect(req.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: failure, code: 'INTERNAL_ERROR' }),
      expect.any(String),
    );
  });

  it('does not log expected client errors as failures', () => {
    const req = mockReq();

    run(new UnauthorizedError(), mockRes(), req);

    expect(req.log.error).not.toHaveBeenCalled();
  });
});

describe('notFoundHandler', () => {
  it('describes the missing route', () => {
    const res = mockRes();

    notFoundHandler(
      mockReq({ method: 'GET', originalUrl: '/api/nope', id: 'r-1' } as Partial<Request>),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Route not found: GET /api/nope',
      code: 'ROUTE_NOT_FOUND',
      context: 'platform',
      requestId: 'r-1',
    });
  });
});
