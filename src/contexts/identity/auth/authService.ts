import bcrypt from 'bcryptjs';
import { AppDataSource } from '../../../config/database';
import { env } from '../../../config/env';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../../shared/errors';
import { signAuthToken } from '../../../shared/jwt';
import { DEFAULT_ROLES, normalizeRoles, Role } from '../../../shared/roles';
import { User, UserStatus } from '../models/User';
import { LoginInput, RegisterInput } from './authSchemas';

const BCRYPT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export class AuthService {
  private static get repository() {
    return AppDataSource.getRepository(User);
  }

  static async register({ name, email, password, roles }: RegisterInput): Promise<AuthResult> {
    const existing = await this.repository.findOne({ where: { email }, select: ['id'] });
    if (existing) {
      throw new ConflictError('Email is already registered', 'EMAIL_ALREADY_REGISTERED');
    }

    const user = await this.repository.save(
      this.repository.create({
        name,
        email,
        password: await bcrypt.hash(password, BCRYPT_ROUNDS),
        roles: withAdminIfAllowlisted(email, normalizeRoles(roles ?? DEFAULT_ROLES)),
      }),
    );

    return issue(user);
  }

  static async login({ email, password }: LoginInput): Promise<AuthResult> {
    const user = await this.repository.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'password', 'roles', 'status', 'createdAt', 'updatedAt'],
    });

    // Same error for unknown email and wrong password so the endpoint does not
    // reveal which accounts exist.
    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !passwordMatches) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Checked after the password so the status of an account is not revealed to anyone who
    // does not know its credentials.
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('This account is suspended', 'ACCOUNT_SUSPENDED');
    }

    // Lets an existing account be promoted by adding its email to ADMIN_EMAILS.
    const promoted = withAdminIfAllowlisted(user.email, user.roles);
    if (promoted.length !== user.roles.length) {
      user.roles = promoted;
      await this.repository.update(user.id, { roles: promoted });
    }

    return issue(user);
  }
}

/** Grants the admin role to emails listed in ADMIN_EMAILS; nobody can pick it for themselves. */
export function withAdminIfAllowlisted(email: string, roles: Role[]): Role[] {
  const isAdmin = env.adminEmails.includes(email.toLowerCase());
  return isAdmin && !roles.includes(Role.ADMIN) ? [...roles, Role.ADMIN] : roles;
}

export function toPublicUser(user: User): PublicUser {
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

export function issue(user: User): AuthResult {
  return { token: signAuthToken(user.id, user.roles), user: toPublicUser(user) };
}
