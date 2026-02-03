import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { BookStatus } from '../types';

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, user => user.books, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255 })
  author!: string;

  @Column({ type: 'varchar', length: 13, nullable: true, unique: true })
  isbn?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  publisher?: string;

  @Column({ name: 'published_year', type: 'integer', nullable: true })
  publishedYear?: number;

  @Column({ type: 'integer', nullable: true })
  pages?: number;

  @Column({ type: 'varchar', length: 10, default: 'pt-BR' })
  language!: string;

  @Column({ name: 'cover_url', type: 'text', nullable: true })
  coverUrl?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    default: BookStatus.TO_READ 
  })
  status!: BookStatus;

  @Column({ type: 'integer', nullable: true })
  rating?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}