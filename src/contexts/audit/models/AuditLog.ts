import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only record of who changed what. Written by admin and moderation actions. */
@Entity('audit_logs')
@Index('idx_audit_logs_target', ['targetType', 'targetId'])
@Index('idx_audit_logs_created_at', ['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'actor_id' })
  actorId!: string;

  /** Dotted verb, e.g. `user.update`, `company.verify`, `catalog.approve`. */
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 50, name: 'target_type' })
  targetType!: string;

  @Column({ type: 'varchar', length: 100, name: 'target_id' })
  targetId!: string;

  /** What changed: `{ field: { from, to } }` or free-form context for the action. */
  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
