import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum CatalogBookStatus {
  /** Visible and usable. */
  ACTIVE = 'active',
  /** Taken down by an admin (e.g. an absurd registration). */
  HIDDEN = 'hidden',
}

export enum CatalogReviewStatus {
  /** Registered by a user and usable at once, but not yet checked by an admin. */
  PENDING_REVIEW = 'pending_review',
  REVIEWED = 'reviewed',
}

/**
 * A book exists once in the catalog, no matter how many users shelve it or how many
 * sebos sell it. The ISBN-13 is its identity; books without an ISBN are matched by a
 * normalised title/author/publisher/year/edition key.
 */
@Entity('catalog_books')
@Index('idx_catalog_books_title', ['title'])
@Index('idx_catalog_books_author', ['author'])
export class CatalogBook {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** ISBN-13, digits only. Unique when present. */
  @Index('uq_catalog_books_isbn', { unique: true, where: '"isbn" IS NOT NULL' })
  @Column({ type: 'varchar', length: 13, nullable: true })
  isbn?: string | null;

  /** Identity used to avoid duplicates: `isbn:<isbn13>` or `meta:<normalised fields>`. */
  @Column({ type: 'varchar', length: 700, name: 'dedupe_key', unique: true })
  dedupeKey!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255 })
  author!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  publisher?: string | null;

  @Column({ type: 'int', nullable: true, name: 'published_year' })
  publishedYear?: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  edition?: string | null;

  @Column({ type: 'int', nullable: true })
  pages?: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'cover_url' })
  coverUrl?: string | null;

  @Column({ type: 'enum', enum: CatalogBookStatus, default: CatalogBookStatus.ACTIVE })
  status!: CatalogBookStatus;

  @Column({
    type: 'enum',
    enum: CatalogReviewStatus,
    name: 'review_status',
    default: CatalogReviewStatus.PENDING_REVIEW,
  })
  reviewStatus!: CatalogReviewStatus;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'uuid', name: 'reviewed_by', nullable: true })
  reviewedBy?: string | null;

  @Column({ type: 'timestamp', name: 'reviewed_at', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
