import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum RevisionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * A proposed edit to a catalog book. Nothing changes until an admin approves it, which
 * keeps a good record from being broken by a careless (or malicious) edit.
 */
@Entity('catalog_revisions')
@Index('idx_catalog_revisions_book', ['catalogBookId'])
@Index('idx_catalog_revisions_status', ['status'])
export class CatalogRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'catalog_book_id' })
  catalogBookId!: string;

  @Column({ type: 'uuid', name: 'proposed_by' })
  proposedBy!: string;

  /** Only the fields that would change: `{ field: { from, to } }`. */
  @Column({ type: 'jsonb' })
  changes!: Record<string, { from: unknown; to: unknown }>;

  @Column({ type: 'enum', enum: RevisionStatus, default: RevisionStatus.PENDING })
  status!: RevisionStatus;

  @Column({ type: 'uuid', name: 'reviewed_by', nullable: true })
  reviewedBy?: string | null;

  @Column({ type: 'timestamp', name: 'reviewed_at', nullable: true })
  reviewedAt?: Date | null;

  @Column({ type: 'text', name: 'review_note', nullable: true })
  reviewNote?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
