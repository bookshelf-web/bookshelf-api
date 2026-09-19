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

@Entity('books')
@Index('idx_books_user_id', ['userId'])
@Index('idx_books_status', ['status'])
@Index('idx_books_title', ['title'])
@Index('idx_books_author', ['author'])
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255 })
  author!: string;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  isbn?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  publisher?: string | null;

  @Column({ type: 'int', nullable: true, name: 'published_year' })
  publishedYear?: number | null;

  @Column({ type: 'int', nullable: true })
  pages?: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'int', nullable: true })
  rating?: number | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'cover_url' })
  coverUrl?: string | null;

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
