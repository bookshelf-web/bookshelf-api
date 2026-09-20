import { z } from 'zod';
import { SELF_SERVICE_ROLES } from '../../../shared/roles';

const selfServiceRoles = z.array(z.enum(SELF_SERVICE_ROLES)).default([]);

export const updateRolesSchema = z.object({ add: selfServiceRoles, remove: selfServiceRoles });

export const updateProfileSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required').max(255),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required'),
  newPassword: z
    .string({ required_error: 'New password is required' })
    .min(6, 'Password must be at least 6 characters long'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateRolesInput = z.infer<typeof updateRolesSchema>;
