import { AppDataSource } from '../../../config/database';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../shared/errors';
import { normalizeRoles, Role } from '../../../shared/roles';
import { AuditService, diffFields } from '../../audit';
import { User, UserStatus } from '../models/User';
import { AdminUpdateUserInput, ListUsersQuery } from './usersSchemas';

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toAdminUserView(user: User): AdminUserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class UsersService {
  private static get repository() {
    return AppDataSource.getRepository(User);
  }

  static async list({ page, limit, search, role, status }: ListUsersQuery) {
    const qb = this.repository.createQueryBuilder('user');

    if (search) {
      qb.andWhere('(LOWER(user.name) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))', {
        search: `%${search}%`,
      });
    }
    if (role) qb.andWhere(':role = ANY(user.roles)', { role });
    if (status) qb.andWhere('user.status = :status', { status });

    qb.orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await qb.getManyAndCount();

    return {
      users: users.map(toAdminUserView),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getById(id: string): Promise<AdminUserView> {
    return toAdminUserView(await this.requireUser(id));
  }

  /**
   * Edits an account. Guards keep the platform administrable: nobody can suspend
   * themselves, and the last active admin can neither lose the role nor be suspended.
   */
  static async update(actorId: string, id: string, input: AdminUpdateUserInput): Promise<AdminUserView> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestError('Provide at least one field to change', 'VALIDATION_ERROR');
    }

    const user = await this.requireUser(id);
    const before = { name: user.name, email: user.email, roles: user.roles, status: user.status };

    if (input.status === UserStatus.SUSPENDED && id === actorId) {
      throw new ForbiddenError('You cannot suspend your own account', 'CANNOT_SUSPEND_SELF');
    }

    const nextRoles = input.roles ? normalizeRoles(input.roles) : user.roles;
    const nextStatus = input.status ?? user.status;
    const isAdminNow = user.roles.includes(Role.ADMIN) && user.status === UserStatus.ACTIVE;
    const staysActiveAdmin = nextRoles.includes(Role.ADMIN) && nextStatus === UserStatus.ACTIVE;
    if (isAdminNow && !staysActiveAdmin && (await this.countActiveAdmins()) <= 1) {
      throw new ForbiddenError('The last active admin cannot be removed or suspended', 'LAST_ADMIN');
    }

    if (input.email && input.email !== user.email) {
      const taken = await this.repository.findOne({ where: { email: input.email }, select: ['id'] });
      if (taken && taken.id !== id) {
        throw new ConflictError('Email is already registered', 'EMAIL_ALREADY_REGISTERED');
      }
    }

    if (input.name !== undefined) user.name = input.name;
    if (input.email !== undefined) user.email = input.email;
    if (input.roles !== undefined) user.roles = nextRoles;
    if (input.status !== undefined) user.status = input.status;

    const saved = await this.repository.save(user);

    const changes = diffFields(before, {
      name: saved.name,
      email: saved.email,
      roles: saved.roles,
      status: saved.status,
    });
    if (Object.keys(changes).length > 0) {
      await AuditService.record({ actorId, action: 'user.update', targetType: 'user', targetId: id, changes });
    }

    return toAdminUserView(saved);
  }

  private static countActiveAdmins(): Promise<number> {
    return this.repository
      .createQueryBuilder('user')
      .where(':admin = ANY(user.roles)', { admin: Role.ADMIN })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .getCount();
  }

  private static async requireUser(id: string): Promise<User> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }
    return user;
  }
}
