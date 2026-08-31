import { DataSource } from 'typeorm';
import { User } from '../models/User';
import { Book } from '../models/Book';

// Supabase/Render exigem SSL e fornecem uma DATABASE_URL única em vez de host/porta separados
const useConnectionUrl = !!process.env.DATABASE_URL;

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(useConnectionUrl
    ? {
        url: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USER || 'admin',
        password: process.env.DB_PASSWORD || 'admin123',
        database: process.env.DB_NAME || 'bookshelf',
      }),
  // Em ambiente de teste o banco sempre começa vazio (tmpfs no CI), e não há
  // migrations reais no projeto, então synchronize garante a criação das tabelas.
  // DB_SYNC=true habilita o mesmo comportamento no ambiente hospedado (Render),
  // que não é um banco de produção real, apenas suporte a testes automatizados.
  synchronize: process.env.NODE_ENV === 'test' || process.env.DB_SYNC === 'true',
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Book],
  migrations: [],
  subscribers: [],
});

export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Error connecting to database:', error);
    process.exit(1);
  }
};