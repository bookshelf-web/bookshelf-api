import path from 'path';
import { DataSource } from 'typeorm';
import { env } from './env';
import { User } from '../contexts/identity/models/User';
import { Book } from '../contexts/library/models/Book';
import { Company } from '../contexts/identity/models/Company';
import { CompanyMember } from '../contexts/identity/models/CompanyMember';
import { AuditLog } from '../contexts/audit/models/AuditLog';

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
  // Only the throwaway test database is built with `synchronize`; every other
  // environment is versioned by the migrations in src/migrations.
  synchronize: env.NODE_ENV === 'test',
  migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
  logging: env.NODE_ENV === 'development',
  entities: [User, Book, Company, CompanyMember, AuditLog],
});

// Supabase exposes every `public` table through its REST API using the public
// `anon` key. This API only talks to Postgres directly (role `postgres`, which
// bypasses RLS), so on Supabase we close that door: enable RLS and revoke the
// API roles. It is a no-op on plain Postgres, where those roles do not exist,
// and idempotent, so it is safe to run on every start.
const LOCK_DOWN_API_ROLES_SQL = `
DO $$
DECLARE
  tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOREACH tbl IN ARRAY ARRAY['users', 'books', 'companies', 'company_members', 'audit_logs', 'migrations'] LOOP
      IF to_regclass('public.' || tbl) IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl);
      END IF;
    END LOOP;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END
$$;
`;

export async function lockDownApiRoles(): Promise<void> {
  try {
    await AppDataSource.query(LOCK_DOWN_API_ROLES_SQL);
  } catch (error) {
    console.warn('Could not lock down Supabase API roles:', (error as Error).message);
  }
}

export async function runPendingMigrations(): Promise<void> {
  if (AppDataSource.options.synchronize) return;
  const applied = await AppDataSource.runMigrations();
  if (applied.length > 0) {
    console.log(`Applied migrations: ${applied.map(migration => migration.name).join(', ')}`);
  }
}

export async function initializeDatabase(): Promise<void> {
  await AppDataSource.initialize();
  await runPendingMigrations();
  await lockDownApiRoles();
  console.log('Database connected');
}
