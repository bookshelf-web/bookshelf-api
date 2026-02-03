import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);

  async register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    // Verificar se usuário já existe
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('Email já cadastrado');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    const user = this.userRepository.create({
      name,
      email,
      password: hashedPassword,
    });

    await this.userRepository.save(user);

    // Gerar token
    const token = this.generateToken(user.id, user.email);

    return { user, token };
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Buscar usuário
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new Error('Credenciais inválidas');
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Credenciais inválidas');
    }

    // Gerar token
    const token = this.generateToken(user.id, user.email);

    return { user, token };
  }

  private generateToken(userId: string, email: string): string {
    const secret = process.env.JWT_SECRET || 'default-secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    return jwt.sign(
      { userId, email }, 
      secret, 
      { expiresIn: expiresIn }
    );
  }
}