import bcrypt from 'bcryptjs';
import { AppDataSource } from '../../config/database';
import { User } from '../../models/User';
import { ConflictError, UnauthorizedError } from '../../shared/errors';
import { signAuthToken } from '../../shared/jwt';
import { LoginInput, RegisterInput } from './authSchemas';

const BCRYPT_ROUNDS = 10;

interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthResult {
  token: string;
  user: PublicUser;
}

export class AuthService {
  private static get repository() {
    return AppDataSource.getRepository(User);
  }

  static async register({ name, email, password }: RegisterInput): Promise<AuthResult> {
    const existing = await this.repository.findOne({ where: { email }, select: ['id'] });
    if (existing) {
      throw new ConflictError('Email is already registered', 'EMAIL_ALREADY_REGISTERED');
    }

    const user = await this.repository.save(
      this.repository.create({
        name,
        email,
        password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      }),
    );

    return { token: signAuthToken(user.id), user: toPublicUser(user) };
  }

  static async login({ email, password }: LoginInput): Promise<AuthResult> {
    const user = await this.repository.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'password', 'createdAt', 'updatedAt'],
    });

    // Same error for unknown email and wrong password so the endpoint does not
    // reveal which accounts exist.
    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !passwordMatches) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    return { token: signAuthToken(user.id), user: toPublicUser(user) };
  }
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
