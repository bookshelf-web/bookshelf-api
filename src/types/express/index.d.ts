/**
 * Adds the authenticated user id (populated by `authMiddleware`) to Express'
 * request type so controllers can read `req.userId` without casts.
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
