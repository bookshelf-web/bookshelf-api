import { AppDataSource } from '../../../config/database';
import { BadRequestError, NotFoundError } from '../../../shared/errors';
import { normalizeRoles, Role } from '../../../shared/roles';
import { CompaniesService, CompanyView } from '../companies/companiesService';
import { issue, PublicUser, toPublicUser, AuthResult, withAdminIfAllowlisted } from '../auth/authService';
import { User } from '../models/User';
import { UpdateRolesInput } from './meSchemas';

export interface MeView {
  user: PublicUser;
  companies: CompanyView[];
}

export class MeService {
  private static get users() {
    return AppDataSource.getRepository(User);
  }

  static async getProfile(userId: string): Promise<MeView> {
    const user = await this.requireUser(userId);
    return { user: toPublicUser(user), companies: await CompaniesService.listMine(userId) };
  }

  /**
   * Lets a user opt in or out of the reader, buyer and seller roles. Admin is never
   * touched here. Returns a fresh token because roles are carried in the JWT.
   */
  static async updateRoles(userId: string, { add, remove }: UpdateRolesInput): Promise<AuthResult> {
    if (add.length + remove.length === 0) {
      throw new BadRequestError('Provide at least one role to add or remove', 'VALIDATION_ERROR');
    }
    const user = await this.requireUser(userId);

    const removed: Role[] = remove;
    const kept = user.roles.filter(role => !removed.includes(role));
    const next = normalizeRoles([...kept, ...add]);
    // A removal that would strip the seller's implied buyer role is ignored:
    // normalizeRoles re-adds buyer while seller remains.
    const withAdmin = withAdminIfAllowlisted(user.email, next);

    if (withAdmin.filter(role => role !== Role.ADMIN).length === 0) {
      throw new BadRequestError('An account needs at least one role', 'ROLE_REQUIRED_MINIMUM');
    }

    user.roles = withAdmin;
    await this.users.update(user.id, { roles: withAdmin });
    return issue(user);
  }

  private static async requireUser(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }
    return user;
  }
}
