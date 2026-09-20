import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CatalogBook } from '../../catalog';

export enum ListingCondition {
  NEW = 'new',
  LIKE_NEW = 'like_new',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

export enum ListingStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  REMOVED = 'removed',
}

/** A copy (or several identical copies) of a catalog book offered for sale. */
@Entity('listings')
@Index('idx_listings_seller', ['sellerId'])
@Index('idx_listings_catalog_book', ['catalogBookId'])
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'seller_id' })
  sellerId!: string;

  /** Set when the listing is sold on behalf of a verified company. */
  @Column({ type: 'uuid', name: 'company_id', nullable: true })
  companyId?: string | null;

  @Column({ type: 'uuid', name: 'catalog_book_id' })
  catalogBookId!: string;

  @ManyToOne('CatalogBook', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'catalog_book_id' })
  catalogBook!: CatalogBook;

  @Column({ type: 'int', name: 'price_cents' })
  priceCents!: number;

  @Column({ type: 'enum', enum: ListingCondition })
  condition!: ListingCondition;

  @Column({ type: 'int' })
  quantity!: number;

  /** Flat shipping fee for this listing, charged once per order however many copies are bought. */
  @Column({ type: 'int', name: 'shipping_fee_cents', default: 0 })
  shippingFeeCents!: number;

  @Column({ type: 'boolean', name: 'pickup_available', default: false })
  pickupAvailable!: boolean;

  @Column({ type: 'varchar', length: 255, name: 'pickup_note', nullable: true })
  pickupNote?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.ACTIVE })
  status!: ListingStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
