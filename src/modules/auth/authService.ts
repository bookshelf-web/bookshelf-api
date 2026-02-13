import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../../config/database';
import { User } from '../../models/User';
import { getJWTSecret } from '../../config/env';

interface RegisterData {
  name: string;
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  private static userRepository = AppDataSource.getRepository(User);

  static async register(data: RegisterData) {
    const { name, email, password } = data;

    // Validações
    if (!name || name.trim() === '') {
      throw new Error('Nome é obrigatório');
    }

    if (!email || email.trim() === '') {
      throw new Error('Email é obrigatório');
    }

    if (!password || password.trim() === '') {
      throw new Error('Senha é obrigatório');
    }

    if (password.length < 6) {
      throw new Error('Senha deve ter no mínimo 6 caracteres');
    }

    // Verificar se email já existe
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      const error = new Error('Email já cadastrado');
      (error as any).statusCode = 409;
      throw error;
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    const user = this.userRepository.create({
      name,
      email,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);

    // Gerar token
    const JWT_SECRET = getJWTSecret();
    const token = jwt.sign(
      { userId: savedUser.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remover senha do retorno
    const { password: _, ...userWithoutPassword } = savedUser;

    return {
      message: 'Usuário criado com sucesso',
      token,
      user: userWithoutPassword,
    };
  }

  static async login(data: LoginData) {
    const { email, password } = data;

    // Validações
    if (!email || email.trim() === '') {
      throw new Error('Email é obrigatório');
    }

    if (!password || password.trim() === '') {
      throw new Error('Senha é obrigatório');
    }

    // Buscar usuário
    const user = await this.userRepository.findOne({ where: { email } });

    // SEGURANÇA: Retornar mesma mensagem para email inexistente OU senha incorreta
    if (!user) {
      const error = new Error('Credenciais inválidas');
      (error as any).statusCode = 401;
      throw error;
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const error = new Error('Credenciais inválidas');
      (error as any).statusCode = 401;
      throw error;
    }

    // Gerar token
    const JWT_SECRET = getJWTSecret();
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remover senha do retorno
    const { password: _, ...userWithoutPassword } = user;

    return {
      message: 'Login realizado com sucesso',
      token,
      user: userWithoutPassword,
    };
  }
}