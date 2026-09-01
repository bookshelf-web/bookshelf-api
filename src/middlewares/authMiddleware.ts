import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../shared/errors';
import { verifyAuthToken } from '../shared/jwt';

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Authentication token not provided', 'TOKEN_MISSING');
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Malformed authentication token', 'TOKEN_MALFORMED');
  }

  req.userId = verifyAuthToken(token).userId;
  next();
};
