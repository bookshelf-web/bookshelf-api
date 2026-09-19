import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyMember } from './CompanyMember';

/** A business (e.g. a second-hand bookstore) that sells through the marketplace. */
@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Razão social. */
  @Column({ type: 'varchar', length: 255, name: 'legal_name' })
  legalName!: string;

  /** Nome fantasia. */
  @Column({ type: 'varchar', length: 255, name: 'trade_name', nullable: true })
  tradeName?: string | null;

  /** 14 digits, no punctuation. */
  @Column({ type: 'varchar', length: 14, unique: true })
  cnpj!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 255, name: 'address_street' })
  addressStreet!: string;

  @Column({ type: 'varchar', length: 20, name: 'address_number' })
  addressNumber!: string;

  @Column({ type: 'varchar', length: 100, name: 'address_complement', nullable: true })
  addressComplement?: string | null;

  @Column({ type: 'varchar', length: 100, name: 'address_district' })
  addressDistrict!: string;

  @Column({ type: 'varchar', length: 100, name: 'address_city' })
  addressCity!: string;

  @Column({ type: 'varchar', length: 2, name: 'address_state' })
  addressState!: string;

  @Column({ type: 'varchar', length: 8, name: 'address_zip' })
  addressZip!: string;

  /** Set by an admin after checking the company; required to sell (enforced by the marketplace). */
  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  @Column({ type: 'timestamp', name: 'verified_at', nullable: true })
  verifiedAt?: Date | null;

  @Column({ type: 'uuid', name: 'verified_by', nullable: true })
  verifiedBy?: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @OneToMany(() => CompanyMember, member => member.company)
  members!: CompanyMember[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
