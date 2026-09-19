import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Account roles (reader/buyer/seller/admin) and company registration.
 * Existing accounts predate roles and were library-only, so they default to reader.
 */
export class AddRolesAndCompanies1789948800000 implements MigrationInterface {
  name = 'AddRolesAndCompanies1789948800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_roles_enum" AS ENUM ('reader', 'buyer', 'seller', 'admin');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "roles" "users_roles_enum" array NOT NULL DEFAULT '{reader}'
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "company_members_role_enum" AS ENUM ('owner', 'manager', 'staff');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "companies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "legal_name" character varying(255) NOT NULL,
        "trade_name" character varying(255),
        "cnpj" character varying(14) NOT NULL,
        "email" character varying(255) NOT NULL,
        "phone" character varying(20),
        "address_street" character varying(255) NOT NULL,
        "address_number" character varying(20) NOT NULL,
        "address_complement" character varying(100),
        "address_district" character varying(100) NOT NULL,
        "address_city" character varying(100) NOT NULL,
        "address_state" character varying(2) NOT NULL,
        "address_zip" character varying(8) NOT NULL,
        "verified" boolean NOT NULL DEFAULT false,
        "verified_at" TIMESTAMP,
        "verified_by" uuid,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_companies_cnpj" UNIQUE ("cnpj"),
        CONSTRAINT "PK_companies_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_members" (
        "company_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "company_members_role_enum" NOT NULL DEFAULT 'staff',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_members" PRIMARY KEY ("company_id", "user_id"),
        CONSTRAINT "FK_company_members_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_company_members_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_company_members_user_id" ON "company_members" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "company_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "companies"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "company_members_role_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "roles"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_roles_enum"`);
  }
}
