import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema (users + books).
 *
 * Every statement is guarded (IF NOT EXISTS / duplicate_object) so the migration
 * is also safe on databases that already have these tables, whether they were
 * created earlier by TypeORM `synchronize` (the hosted database) or by
 * `scripts/init-db.sql` (local Docker): those simply record it as applied.
 */
export class InitialSchema1789776000000 implements MigrationInterface {
  name = 'InitialSchema1789776000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "books_status_enum" AS ENUM ('to_read', 'reading', 'read');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password" character varying(255) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "books" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "author" character varying(255) NOT NULL,
        "isbn" character varying(20),
        "publisher" character varying(255),
        "published_year" integer,
        "pages" integer,
        "language" character varying(10),
        "description" text,
        "rating" integer,
        "notes" text,
        "cover_url" character varying(500),
        "status" "books_status_enum" NOT NULL DEFAULT 'to_read',
        "started_at" TIMESTAMP,
        "finished_at" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_books_isbn" UNIQUE ("isbn"),
        CONSTRAINT "PK_books_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_books_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "books"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "books_status_enum"`);
  }
}
