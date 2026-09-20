import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItem } from './OrderItem';

export enum OrderStatus {
  AWAITING_PAYMENT = 'awaiting_payment',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum ShippingMethod {
  SHIP = 'ship',
  PICKUP = 'pickup',
}

export type CancelReason = 'buyer' | 'expired';

export interface ShippingAddress {
  recipient: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
  zip: string;
}

/** One purchase from a single seller. */
@Entity('orders')
@Index('idx_orders_buyer', ['buyerId'])
@Index('idx_orders_seller', ['sellerId'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'buyer_id' })
  buyerId!: string;

  @Column({ type: 'uuid', name: 'seller_id' })
  sellerId!: string;

  @Column({ type: 'uuid', name: 'company_id', nullable: true })
  companyId?: string | null;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.AWAITING_PAYMENT })
  status!: OrderStatus;

  @Column({ type: 'enum', enum: ShippingMethod, name: 'shipping_method' })
  shippingMethod!: ShippingMethod;

  @Column({ type: 'jsonb', name: 'shipping_address', nullable: true })
  shippingAddress?: ShippingAddress | null;

  @Column({ type: 'int', name: 'subtotal_cents' })
  subtotalCents!: number;

  @Column({ type: 'int', name: 'shipping_cents' })
  shippingCents!: number;

  @Column({ type: 'int', name: 'total_cents' })
  totalCents!: number;

  @Column({ type: 'varchar', length: 60, name: 'tracking_code', nullable: true })
  trackingCode?: string | null;

  @Column({ type: 'varchar', length: 20, name: 'cancel_reason', nullable: true })
  cancelReason?: CancelReason | null;

  @Column({ type: 'timestamp', name: 'paid_at', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'timestamp', name: 'shipped_at', nullable: true })
  shippedAt?: Date | null;

  @Column({ type: 'timestamp', name: 'delivered_at', nullable: true })
  deliveredAt?: Date | null;

  @OneToMany(() => OrderItem, item => item.order, { cascade: true })
  items!: OrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
