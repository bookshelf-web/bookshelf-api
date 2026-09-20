import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BookStatus } from '../types';

/**
 * A reader's shelf entry. What the book *is* (title, author, ISBN...) lives in the shared
 * catalog; this row only holds what is personal to the reader.
 */
@Entity('books')
@Index('idx_books_user_id', ['userId'])
@Index('idx_books_status', ['status'])
@Index('idx_books_catalog_book_id', ['catalogBookId'])
@Index('uq_books_user_catalog', ['userId', 'catalogBookId'], { unique: true })
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'catalog_book_id', type: 'uuid' })
  catalogBookId!: string;

  // Related by entity name so this context never imports the catalog's classes.
  @ManyToOne('CatalogBook', { nullable: false })
  @JoinColumn({ name: 'catalog_book_id' })
  catalogBook!: unknown;

  @Column({ type: 'int', nullable: true })
  rating?: number | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({
    type: 'enum',
    enum: BookStatus,
    default: BookStatus.TO_READ,
  })
  status!: BookStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'finished_at' })
  finishedAt?: Date | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne('User', 'books')
  @JoinColumn({ name: 'user_id' })
  user!: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
