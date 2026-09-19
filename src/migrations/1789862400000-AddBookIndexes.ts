import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the queries the API actually runs: every list is scoped by
 * `user_id` and can be filtered by status, or searched by title/author.
 * Names match the ones in `scripts/init-db.sql`, so IF NOT EXISTS makes this a
 * no-op on databases created from that script.
 */
export class AddBookIndexes1789862400000 implements MigrationInterface {
  name = 'AddBookIndexes1789862400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_books_user_id" ON "books" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_books_status" ON "books" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_books_title" ON "books" ("title")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_books_author" ON "books" ("author")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_books_author"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_books_title"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_books_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_books_user_id"`);
  }
}
