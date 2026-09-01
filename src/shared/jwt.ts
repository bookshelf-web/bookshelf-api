import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

interface TokenPayload {
  userId: string;
}

export function signAuthToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAuthToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
      throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
    }
    return { userId: decoded.userId };
  } catch {
    throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
  }
}
