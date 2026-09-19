import { z } from 'zod';
import { SELF_SERVICE_ROLES } from '../../../shared/roles';

const selfServiceRoles = z.array(z.enum(SELF_SERVICE_ROLES)).default([]);

export const updateRolesSchema = z.object({ add: selfServiceRoles, remove: selfServiceRoles });

export type UpdateRolesInput = z.infer<typeof updateRolesSchema>;
