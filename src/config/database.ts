import { DataSource } from 'typeorm';
import { env } from './env';
import { User } from '../models/User';
import { Book } from '../models/Book';

// Hosted providers (Supabase/Render) give a single DATABASE_URL and require SSL.
const connection = env.DATABASE_URL
  ? { url: env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT ?? 5432,
      username: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    };

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...connection,
  // The project has no real migrations: `synchronize` creates the schema for the
  // (throwaway) test database and, when DB_SYNC=true, for the hosted test env.
  synchronize: env.NODE_ENV === 'test' || env.DB_SYNC,
  logging: env.NODE_ENV === 'development',
  entities: [User, Book],
});

export async function initializeDatabase(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connected');
}
