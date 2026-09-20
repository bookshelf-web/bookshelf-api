import { z } from 'zod';
import { Role } from '../../../shared/roles';
import { UserStatus } from '../models/User';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const userIdParamsSchema = z.object({ id: z.string().uuid('Invalid user id') });

/** Admins may set any role, including admin (unlike the self-service endpoints). */
export const adminUpdateUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(255).optional(),
    email: z.string().trim().toLowerCase().email('Invalid email address').optional(),
    roles: z.array(z.nativeEnum(Role)).min(1, 'A user needs at least one role').optional(),
    status: z.nativeEnum(UserStatus).optional(),
  })
  .strict();

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
