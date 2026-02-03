import { DataSource } from 'typeorm';
import { User } from '../models/User';
import { Book } from '../models/Book';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'admin123',
  database: process.env.DB_NAME || 'bookshelf',
  synchronize: false,
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