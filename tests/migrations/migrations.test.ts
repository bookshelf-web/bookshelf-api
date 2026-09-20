import fs from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AppDataSource } from '../../src/config/database';
import { setupTestDatabase, closeTestDatabase } from '../setup/testDatabase';

const EXPECTED_INDEXES = [
  'idx_books_user_id',
  'idx_books_status',
  'idx_books_title',
  'idx_books_author',
];

// A DATABASE_URL points at one fixed database, so a scratch database cannot be derived from it.
const usesConnectionUrl = Boolean((AppDataSource.options as PostgresConnectionOptions).url);
const describeMigrations = usesConnectionUrl ? describe.skip : describe;

describeMigrations('database migrations', () => {
  const scratchDatabases: string[] = [];
  const openConnections: DataSource[] = [];

  async function createScratchDatabase(): Promise<DataSource> {
    const name = `bookshelf_migrations_${process.pid}_${Date.now()}_${scratchDatabases.length}`;
    await AppDataSource.query(`CREATE DATABASE "${name}"`);
    scratchDatabases.push(name);

    const connection = new DataSource({
      ...(AppDataSource.options as PostgresConnectionOptions),
      database: name,
      synchronize: false,
      migrationsRun: false,
      logging: false,
    });
    await connection.initialize();
    openConnections.push(connection);
    return connection;
  }

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    for (const connection of openConnections) {
      if (connection.isInitialized) await connection.destroy();
    }
    for (const name of scratchDatabases) {
      await AppDataSource.query(`DROP DATABASE IF EXISTS "${name}"`);
    }
    await closeTestDatabase();
  });

  it('builds the full schema on an empty database', async () => {
    const db = await createScratchDatabase();

    const applied = await db.runMigrations();

    expect(applied.map(migration => migration.name)).toEqual([
      'InitialSchema1789776000000',
      'AddBookIndexes1789862400000',
      'AddRolesAndCompanies1789948800000',
      'AddUserStatusAndAuditLog1790035200000',
    ]);

    for (const metadata of db.entityMetadatas) {
      const rows: { column_name: string }[] = await db.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [metadata.tableName],
      );
      const existing = rows.map(row => row.column_name);
      const expected = metadata.columns.map(column => column.databaseName);
      expect(existing).toEqual(expect.arrayContaining(expected));
    }

    const indexes: { indexname: string }[] = await db.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'books'`,
    );
    expect(indexes.map(row => row.indexname)).toEqual(expect.arrayContaining(EXPECTED_INDEXES));
  });

  it('is idempotent: running again applies nothing', async () => {
    const db = await createScratchDatabase();
    await db.runMigrations();

    expect(await db.runMigrations()).toEqual([]);
  });

  it('accepts a database that was created from scripts/init-db.sql', async () => {
    const db = await createScratchDatabase();
    const initSql = fs.readFileSync(path.join(__dirname, '../../scripts/init-db.sql'), 'utf8');
    await db.query(initSql);

    await expect(db.runMigrations()).resolves.toHaveLength(4);

    const rows = await db.query(`SELECT count(*)::int AS total FROM books`);
    expect(rows[0].total).toBe(0);
  });

  it('can be reverted', async () => {
    const db = await createScratchDatabase();
    await db.runMigrations();

    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration();

    const tables: { table_name: string }[] = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('users', 'books', 'companies', 'company_members', 'audit_logs')`,
    );
    expect(tables).toEqual([]);
  });
});
