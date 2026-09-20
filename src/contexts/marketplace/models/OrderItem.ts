import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './Order';

/** What was bought, frozen at purchase time so later edits to the listing or catalog do not rewrite history. */
@Entity('order_items')
@Index('idx_order_items_order', ['orderId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, order => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @Column({ type: 'uuid', name: 'catalog_book_id' })
  catalogBookId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255 })
  author!: string;

  @Column({ type: 'varchar', length: 13, nullable: true })
  isbn?: string | null;

  @Column({ type: 'int', name: 'unit_price_cents' })
  unitPriceCents!: number;

  @Column({ type: 'int', name: 'shipping_fee_cents', default: 0 })
  shippingFeeCents!: number;

  @Column({ type: 'int' })
  quantity!: number;
}
