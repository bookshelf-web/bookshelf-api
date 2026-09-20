import { MigrationInterface, QueryRunner } from 'typeorm';

/** Second-hand bookstore: listings, orders and the simulated payment charges. */
export class AddMarketplaceAndPayments1790208000000 implements MigrationInterface {
  name = 'AddMarketplaceAndPayments1790208000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "listings_condition_enum" AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "listings_status_enum" AS ENUM ('active', 'paused', 'removed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "orders_status_enum" AS ENUM ('awaiting_payment', 'paid', 'shipped', 'delivered', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "orders_shipping_method_enum" AS ENUM ('ship', 'pickup');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "seller_id" uuid NOT NULL,
        "company_id" uuid,
        "catalog_book_id" uuid NOT NULL,
        "price_cents" integer NOT NULL,
        "condition" "listings_condition_enum" NOT NULL,
        "quantity" integer NOT NULL,
        "shipping_fee_cents" integer NOT NULL DEFAULT 0,
        "pickup_available" boolean NOT NULL DEFAULT false,
        "pickup_note" character varying(255),
        "description" text,
        "status" "listings_status_enum" NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_listings_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_listings_price" CHECK ("price_cents" > 0),
        CONSTRAINT "CHK_listings_quantity" CHECK ("quantity" >= 0),
        CONSTRAINT "FK_listings_catalog_book" FOREIGN KEY ("catalog_book_id") REFERENCES "catalog_books"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listings_seller" ON "listings" ("seller_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listings_catalog_book" ON "listings" ("catalog_book_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "buyer_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "company_id" uuid,
        "status" "orders_status_enum" NOT NULL DEFAULT 'awaiting_payment',
        "shipping_method" "orders_shipping_method_enum" NOT NULL,
        "shipping_address" jsonb,
        "subtotal_cents" integer NOT NULL,
        "shipping_cents" integer NOT NULL,
        "total_cents" integer NOT NULL,
        "tracking_code" character varying(60),
        "cancel_reason" character varying(20),
        "paid_at" TIMESTAMP,
        "shipped_at" TIMESTAMP,
        "delivered_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_buyer" ON "orders" ("buyer_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_seller" ON "orders" ("seller_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "listing_id" uuid NOT NULL,
        "catalog_book_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "author" character varying(255) NOT NULL,
        "isbn" character varying(13),
        "unit_price_cents" integer NOT NULL,
        "shipping_fee_cents" integer NOT NULL DEFAULT 0,
        "quantity" integer NOT NULL,
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_order_items_order" ON "order_items" ("order_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_charges" (
        "id" uuid NOT NULL,
        "gateway" character varying(30) NOT NULL,
        "simulated" boolean NOT NULL DEFAULT true,
        "method" character varying(10) NOT NULL,
        "amount_cents" integer NOT NULL,
        "status" character varying(10) NOT NULL,
        "reference" character varying(100) NOT NULL,
        "failure_reason" character varying(30),
        "pix_code" character varying(120),
        "pix_expires_at" TIMESTAMP,
        "card_brand" character varying(20),
        "card_last4" character varying(4),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_charges_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payment_charges_reference" ON "payment_charges" ("reference")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_charges"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "listings"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "orders_shipping_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "orders_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "listings_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "listings_condition_enum"`);
  }
}
