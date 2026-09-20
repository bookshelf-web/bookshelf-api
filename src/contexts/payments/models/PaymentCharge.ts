import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** A charge created by the simulated gateway. Card numbers are never stored, only brand and last four. */
@Entity('payment_charges')
@Index('idx_payment_charges_reference', ['reference'])
export class PaymentCharge {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  gateway!: string;

  @Column({ type: 'boolean', default: true })
  simulated!: boolean;

  @Column({ type: 'varchar', length: 10 })
  method!: 'pix' | 'card';

  @Column({ type: 'int', name: 'amount_cents' })
  amountCents!: number;

  @Column({ type: 'varchar', length: 10 })
  status!: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

  /** The id of what is being paid for (an order id). */
  @Column({ type: 'varchar', length: 100 })
  reference!: string;

  @Column({ type: 'varchar', length: 30, name: 'failure_reason', nullable: true })
  failureReason?: string | null;

  @Column({ type: 'varchar', length: 120, name: 'pix_code', nullable: true })
  pixCode?: string | null;

  @Column({ type: 'timestamp', name: 'pix_expires_at', nullable: true })
  pixExpiresAt?: Date | null;

  @Column({ type: 'varchar', length: 20, name: 'card_brand', nullable: true })
  cardBrand?: string | null;

  @Column({ type: 'varchar', length: 4, name: 'card_last4', nullable: true })
  cardLast4?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
