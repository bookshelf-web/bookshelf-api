import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Company } from './Company';
import { User } from './User';

export enum CompanyRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  STAFF = 'staff',
}

/** Links a user to a company with a role inside it. */
@Entity('company_members')
@Index('idx_company_members_user_id', ['userId'])
export class CompanyMember {
  @PrimaryColumn({ type: 'uuid', name: 'company_id' })
  companyId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'enum', enum: CompanyRole, default: CompanyRole.STAFF })
  role!: CompanyRole;

  @ManyToOne(() => Company, company => company.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
