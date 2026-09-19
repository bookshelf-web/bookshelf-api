import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { DEFAULT_ROLES, Role } from '../../../shared/roles';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({
    type: 'enum',
    enum: Role,
    array: true,
    // An array, not a function: TypeORM renders it as '{reader}' for enum arrays.
    default: DEFAULT_ROLES,
  })
  roles!: Role[];

  // Never selected by default; queries that need it must opt in explicitly.
  @Column({ type: 'varchar', length: 255, select: false })
  password!: string;

  @OneToMany('Book', 'user')
  books!: unknown[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
