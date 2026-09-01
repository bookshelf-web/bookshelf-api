import { NextFunction, Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError, ValidationError } from '../shared/errors';

interface ErrorBody {
  error: string;
  code: string;
  details?: unknown;
}

const POSTGRES_UNIQUE_VIOLATION = '23505';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
  });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const body = toErrorBody(error);

  if (body.code === 'INTERNAL_ERROR') {
    console.error('Unhandled error:', error);
  }

  res.status(statusFor(error, body)).json(body);
};

function statusFor(error: unknown, body: ErrorBody): number {
  if (error instanceof AppError) return error.statusCode;
  if (error instanceof ZodError) return 400;
  if (isUniqueViolation(error)) return 409;
  return body.code === 'INTERNAL_ERROR' ? 500 : 400;
}

function toErrorBody(error: unknown): ErrorBody {
  if (error instanceof ZodError) {
    error = ValidationError.fromZodError(error);
  }

  if (error instanceof AppError) {
    return { error: error.message, code: error.code, details: error.details };
  }

  if (isUniqueViolation(error)) {
    return { error: 'Resource already exists', code: 'CONFLICT' };
  }

  return {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
  );
}
