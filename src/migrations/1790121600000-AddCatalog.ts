import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shared catalog: a book exists once (identified by its ISBN-13), and library entries point
 * at it. Existing library books are moved into the catalog:
 *  - books with an ISBN-13 are merged by ISBN (the old schema already made ISBNs unique);
 *  - every other book becomes its own catalog entry (`legacy:<id>` key), so nothing is
 *    merged by guesswork.
 * Moved books are marked as reviewed so the admin queue only holds new registrations.
 * The legacy metadata columns on `books` stay (now nullable) and can be dropped later.
 */
export class AddCatalog1790121600000 implements MigrationInterface {
  name = 'AddCatalog1790121600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [type, values] of [
      ['catalog_books_status_enum', `'active', 'hidden'`],
      ['catalog_books_review_status_enum', `'pending_review', 'reviewed'`],
      ['catalog_revisions_status_enum', `'pending', 'approved', 'rejected'`],
    ]) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "${type}" AS ENUM (${values});
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "catalog_books" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isbn" character varying(13),
        "dedupe_key" character varying(700) NOT NULL,
        "title" character varying(255) NOT NULL,
        "author" character varying(255) NOT NULL,
        "publisher" character varying(255),
        "published_year" integer,
        "edition" character varying(100),
        "pages" integer,
        "language" character varying(10),
        "description" text,
        "cover_url" character varying(500),
        "status" "catalog_books_status_enum" NOT NULL DEFAULT 'active',
        "review_status" "catalog_books_review_status_enum" NOT NULL DEFAULT 'pending_review',
        "created_by" uuid NOT NULL,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_catalog_books_dedupe_key" UNIQUE ("dedupe_key"),
        CONSTRAINT "PK_catalog_books_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_catalog_books_isbn" ON "catalog_books" ("isbn") WHERE "isbn" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_catalog_books_title" ON "catalog_books" ("title")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_catalog_books_author" ON "catalog_books" ("author")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "catalog_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "catalog_book_id" uuid NOT NULL,
        "proposed_by" uuid NOT NULL,
        "changes" jsonb NOT NULL,
        "status" "catalog_revisions_status_enum" NOT NULL DEFAULT 'pending',
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP,
        "review_note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalog_revisions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_catalog_revisions_book" FOREIGN KEY ("catalog_book_id")
          REFERENCES "catalog_books"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_catalog_revisions_book" ON "catalog_revisions" ("catalog_book_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_catalog_revisions_status" ON "catalog_revisions" ("status")`,
    );

    await queryRunner.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "catalog_book_id" uuid`);

    // Move existing library books into the catalog (legacy columns are only read here).
    await queryRunner.query(`
      INSERT INTO "catalog_books" (
        "isbn", "dedupe_key", "title", "author", "publisher", "published_year", "pages",
        "language", "description", "cover_url", "status", "review_status", "created_by",
        "reviewed_at", "created_at", "updated_at"
      )
      SELECT DISTINCT ON (s.key)
        CASE WHEN s.isbn ~ '^97[89][0-9]{10}$' THEN s.isbn END,
        s.key, s.title, s.author, s.publisher, s.published_year, s.pages,
        s.language, s.description, s.cover_url, 'active', 'reviewed', s.user_id,
        now(), s.created_at, s.updated_at
      FROM (
        SELECT b.*,
          CASE WHEN b.isbn ~ '^97[89][0-9]{10}$' THEN 'isbn:' || b.isbn ELSE 'legacy:' || b.id::text END AS key
        FROM "books" b
        WHERE b."catalog_book_id" IS NULL
      ) s
      ORDER BY s.key, s.created_at
      ON CONFLICT ("dedupe_key") DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE "books" b
      SET "catalog_book_id" = c."id"
      FROM "catalog_books" c
      WHERE b."catalog_book_id" IS NULL
        AND c."dedupe_key" = CASE WHEN b."isbn" ~ '^97[89][0-9]{10}$' THEN 'isbn:' || b."isbn" ELSE 'legacy:' || b."id"::text END
    `);

    await queryRunner.query(`ALTER TABLE "books" ALTER COLUMN "catalog_book_id" SET NOT NULL`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "books" ADD CONSTRAINT "FK_books_catalog_book"
          FOREIGN KEY ("catalog_book_id") REFERENCES "catalog_books"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_books_user_catalog" ON "books" ("user_id", "catalog_book_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_books_catalog_book_id" ON "books" ("catalog_book_id")`,
    );

    // The metadata now lives in the catalog; new library rows no longer fill these.
    await queryRunner.query(`ALTER TABLE "books" ALTER COLUMN "title" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "books" ALTER COLUMN "author" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Give library rows their metadata back before the catalog goes away.
    await queryRunner.query(`
      UPDATE "books" b
      SET "title" = c."title", "author" = c."author"
      FROM "catalog_books" c
      WHERE b."catalog_book_id" = c."id" AND (b."title" IS NULL OR b."author" IS NULL)
    `);
    await queryRunner.query(`ALTER TABLE "books" ALTER COLUMN "title" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "books" ALTER COLUMN "author" SET NOT NULL`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_books_catalog_book_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_books_user_catalog"`);
    await queryRunner.query(`ALTER TABLE "books" DROP CONSTRAINT IF EXISTS "FK_books_catalog_book"`);
    await queryRunner.query(`ALTER TABLE "books" DROP COLUMN IF EXISTS "catalog_book_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_revisions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog_books"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "catalog_revisions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "catalog_books_review_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "catalog_books_status_enum"`);
  }
}
