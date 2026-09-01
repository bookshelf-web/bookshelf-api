import { ZodError } from 'zod';

/**
 * Application-level errors. Anything thrown as an `AppError` is translated by the
 * central error handler into a predictable `{ error, code }` HTTP response;
 * everything else becomes a generic 500.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly code: string;

  constructor(message: string, code = 'BAD_REQUEST', details?: unknown) {
    super(message, details);
    this.code = code;
  }
}

interface FieldIssue {
  path: string;
  message: string;
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string, details: FieldIssue[]) {
    super(message, details);
  }

  static fromZodError(error: ZodError): ValidationError {
    const issues: FieldIssue[] = error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const message = issues.map(issue => issue.message).join('; ') || 'Validation failed';
    return new ValidationError(message, issues);
  }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code: string;

  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message);
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code: string;

  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message);
    this.code = code;
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code: string;

  constructor(message: string, code = 'CONFLICT') {
    super(message);
    this.code = code;
  }
}
