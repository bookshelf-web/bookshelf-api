import { z } from 'zod';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../src/shared/errors';

describe('AppError hierarchy', () => {
  it.each([
    [new BadRequestError('bad'), 400, 'BAD_REQUEST'],
    [new BadRequestError('bad', 'CUSTOM'), 400, 'CUSTOM'],
    [new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    [new UnauthorizedError('no', 'TOKEN_MISSING'), 401, 'TOKEN_MISSING'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new ForbiddenError('no', 'ROLE_REQUIRED', { required: ['admin'] }), 403, 'ROLE_REQUIRED'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new NotFoundError('gone', 'BOOK_NOT_FOUND'), 404, 'BOOK_NOT_FOUND'],
    [new ConflictError('dup'), 409, 'CONFLICT'],
    [new ConflictError('dup', 'ISBN_ALREADY_REGISTERED'), 409, 'ISBN_ALREADY_REGISTERED'],
  ])('%p maps to HTTP %i with code %s', (error, status, code) => {
    expect(error.statusCode).toBe(status);
    expect(error.code).toBe(code);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(error.constructor.name);
  });

  it('keeps details on the error', () => {
    expect(new ForbiddenError('x', 'C', { a: 1 }).details).toEqual({ a: 1 });
  });

  describe('ValidationError.fromZodError', () => {
    const schema = z.object({
      title: z.string().min(1, 'Title is required'),
      nested: z.object({ pages: z.number({ invalid_type_error: 'Pages must be a number' }) }),
    });

    it('lists every failing rule with its path and joins the messages', () => {
      const parsed = schema.safeParse({ title: '', nested: { pages: 'x' } });
      if (parsed.success) throw new Error('expected failure');

      const error = ValidationError.fromZodError(parsed.error);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Title is required; Pages must be a number');
      expect(error.details).toEqual([
        { path: 'title', message: 'Title is required' },
        { path: 'nested.pages', message: 'Pages must be a number' },
      ]);
    });

    it('falls back to a generic message when there are no issues', () => {
      expect(ValidationError.fromZodError(new z.ZodError([])).message).toBe('Validation failed');
    });
  });
});
