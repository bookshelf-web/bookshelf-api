import { MigrationInterface, QueryRunner } from 'typeorm';

/** Account suspension and the audit trail for admin and moderation actions. */
export class AddUserStatusAndAuditLog1790035200000 implements MigrationInterface {
  name = 'AddUserStatusAndAuditLog1790035200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_status_enum" AS ENUM ('active', 'suspended');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "status" "users_status_enum" NOT NULL DEFAULT 'active'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_id" uuid NOT NULL,
        "action" character varying(100) NOT NULL,
        "target_type" character varying(50) NOT NULL,
        "target_id" character varying(100) NOT NULL,
        "changes" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_logs_target" ON "audit_logs" ("target_type", "target_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_status_enum"`);
  }
}
