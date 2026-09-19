import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';
import { DEFAULT_ROLES, Role } from './roles';

export interface TokenPayload {
  userId: string;
  roles: Role[];
}

export function signAuthToken(userId: string, roles: Role[] = DEFAULT_ROLES): string {
  return jwt.sign({ userId, roles }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

const KNOWN_ROLES = new Set<string>(Object.values(Role));

export function verifyAuthToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
      throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
    }
    // Tokens issued before roles existed carry none; those accounts were library-only.
    const claimed: unknown[] = Array.isArray(decoded.roles) ? decoded.roles : DEFAULT_ROLES;
    const roles = claimed.filter((role): role is Role => KNOWN_ROLES.has(String(role)));
    return { userId: decoded.userId, roles };
  } catch {
    throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
  }
}
