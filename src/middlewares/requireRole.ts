import { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../shared/errors';
import { Role } from '../shared/roles';

/**
 * Lets the request through only if the authenticated user holds at least one of the
 * given roles. Must run after `authMiddleware`.
 */
export const requireRole =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const roles = req.userRoles ?? [];
    if (!allowed.some(role => roles.includes(role))) {
      throw new ForbiddenError(`This action requires one of the roles: ${allowed.join(', ')}`, 'ROLE_REQUIRED', {
        required: allowed,
      });
    }
    next();
  };
