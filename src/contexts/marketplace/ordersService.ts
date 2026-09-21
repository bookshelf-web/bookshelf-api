import { EntityManager, In } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { contextLogger } from '../../shared/logger';
import { CatalogBookStatus, CatalogService } from '../catalog';
import { IdentityDirectory } from '../identity';
import { PaymentCharge, PaymentsService, toChargeView, type ChargeView } from '../payments';
import type { CreateOrderInput, PayOrderInput } from './marketplaceSchemas';
import { Listing, ListingStatus } from './models/Listing';
import { Order, OrderStatus, ShippingMethod, type CancelReason, type ShippingAddress } from './models/Order';
import { OrderItem } from './models/OrderItem';
import { calculateTotals, canTransition } from './orderRules';

const log = contextLogger('marketplace');

/** An order nobody paid within this time is cancelled and its stock goes back on sale. */
export const ORDER_HOLD_HOURS = 24;

export interface OrderView {
  id: string;
  status: OrderStatus;
  shippingMethod: ShippingMethod;
  shippingAddress: ShippingAddress | null;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  trackingCode: string | null;
  cancelReason: CancelReason | null;
  items: Array<Pick<OrderItem, 'id' | 'listingId' | 'catalogBookId' | 'title' | 'author' | 'isbn' | 'unitPriceCents' | 'quantity'>>;
  buyer: { id: string; name: string };
  seller: { id: string; name: string };
  payment: ChargeView | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

interface OrdersQuery {
  status?: OrderStatus;
  page: number;
  limit: number;
}

export class OrdersService {
  private static get orders() {
    return AppDataSource.getRepository(Order);
  }

  // ─── Buying ──────────────────────────────────────────────────────────────

  static async create(buyerId: string, input: CreateOrderInput): Promise<OrderView> {
    const wanted = new Map<string, number>();
    for (const item of input.items) wanted.set(item.listingId, (wanted.get(item.listingId) ?? 0) + item.quantity);

    const orderId = await AppDataSource.transaction(async manager => {
      const listings = await manager.find(Listing, { where: { id: In([...wanted.keys()]) }, lock: { mode: 'pessimistic_write' } });
      if (listings.length !== wanted.size) {
        throw new ConflictError('A listing is no longer available', 'LISTING_UNAVAILABLE');
      }

      const books = await CatalogService.findByIds([...new Set(listings.map(listing => listing.catalogBookId))]);
      for (const listing of listings) {
        const book = books.get(listing.catalogBookId);
        if (listing.status !== ListingStatus.ACTIVE || !book || book.status !== CatalogBookStatus.ACTIVE) {
          throw new ConflictError('A listing is no longer available', 'LISTING_UNAVAILABLE');
        }
        if (listing.sellerId === buyerId) {
          throw new BadRequestError('You cannot buy your own listing', 'SELF_PURCHASE');
        }
        if ((wanted.get(listing.id) as number) > listing.quantity) {
          throw new ConflictError(`Only ${listing.quantity} left of "${book.title}"`, 'INSUFFICIENT_STOCK');
        }
        if (input.shippingMethod === ShippingMethod.PICKUP && !listing.pickupAvailable) {
          throw new BadRequestError(`"${book.title}" is not available for pickup`, 'PICKUP_UNAVAILABLE');
        }
      }

      const sellerId = listings[0].sellerId;
      if (listings.some(listing => listing.sellerId !== sellerId)) {
        throw new BadRequestError('An order can only contain items from a single seller', 'MIXED_SELLERS');
      }

      const lines = listings.map(listing => ({
        listing,
        quantity: wanted.get(listing.id) as number,
      }));
      const totals = calculateTotals(
        lines.map(line => ({
          unitPriceCents: line.listing.priceCents,
          quantity: line.quantity,
          shippingFeeCents: line.listing.shippingFeeCents,
        })),
        input.shippingMethod,
      );

      for (const line of lines) {
        await manager.decrement(Listing, { id: line.listing.id }, 'quantity', line.quantity);
      }

      const order = await manager.save(
        manager.create(Order, {
          buyerId,
          sellerId,
          companyId: listings[0].companyId ?? null,
          shippingMethod: input.shippingMethod,
          shippingAddress: input.shippingMethod === ShippingMethod.SHIP ? (input.shippingAddress as ShippingAddress) : null,
          ...totals,
          items: lines.map(line => {
            const book = books.get(line.listing.catalogBookId)!;
            return manager.create(OrderItem, {
              listingId: line.listing.id,
              catalogBookId: book.id,
              title: book.title,
              author: book.author,
              isbn: book.isbn ?? null,
              unitPriceCents: line.listing.priceCents,
              shippingFeeCents: line.listing.shippingFeeCents,
              quantity: line.quantity,
            });
          }),
        }),
      );
      return order.id;
    });

    log.info({ orderId, buyerId }, 'order created');
    return this.get(buyerId, orderId);
  }

  static async pay(buyerId: string, orderId: string, input: PayOrderInput): Promise<OrderView> {
    const order = await this.refreshed(await this.requireParticipant(buyerId, orderId, 'buyer'));
    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new ConflictError('This order cannot be paid', 'ORDER_NOT_PAYABLE');
    }

    await PaymentsService.createCharge({
      method: input.method,
      amountCents: order.totalCents,
      reference: order.id,
      cardNumber: input.cardNumber,
    });
    return this.get(buyerId, orderId);
  }

  /** The simulator's "Simular pagamento" button for a pending Pix. */
  static async simulatePixPayment(buyerId: string, orderId: string): Promise<OrderView> {
    const order = await this.refreshed(await this.requireParticipant(buyerId, orderId, 'buyer'));
    const charge = await PaymentsService.latestForReference(order.id);
    if (order.status !== OrderStatus.AWAITING_PAYMENT || !charge || charge.status !== 'pending') {
      throw new ConflictError('There is no pending Pix to pay for this order', 'NO_PENDING_PIX');
    }

    await PaymentsService.simulatePixPayment(charge.id);
    return this.get(buyerId, orderId);
  }

  static async cancel(buyerId: string, orderId: string): Promise<OrderView> {
    const order = await this.refreshed(await this.requireParticipant(buyerId, orderId, 'buyer'));
    if (!canTransition(order.status, OrderStatus.CANCELLED)) {
      throw new ConflictError('Only an order awaiting payment can be cancelled', 'ORDER_NOT_CANCELLABLE');
    }

    await this.cancelAndRestock(order, 'buyer');
    return this.get(buyerId, orderId);
  }

  // ─── Fulfilment ──────────────────────────────────────────────────────────

  static async ship(sellerId: string, orderId: string, trackingCode: string): Promise<OrderView> {
    const order = await this.requireParticipant(sellerId, orderId, 'seller');
    if (order.shippingMethod !== ShippingMethod.SHIP) {
      throw new ConflictError('A pickup order is not shipped', 'ORDER_IS_PICKUP');
    }
    if (!canTransition(order.status, OrderStatus.SHIPPED)) {
      throw new ConflictError('Only a paid order can be shipped', 'ORDER_NOT_SHIPPABLE');
    }

    order.status = OrderStatus.SHIPPED;
    order.trackingCode = trackingCode;
    order.shippedAt = new Date();
    await this.orders.save(order);
    return this.get(sellerId, orderId);
  }

  /** The buyer confirms receipt of a shipped order; the seller hands over a paid pickup order. */
  static async deliver(userId: string, orderId: string): Promise<OrderView> {
    const order = await this.requireParticipant(userId, orderId);
    const isBuyer = order.buyerId === userId;
    const shippedByBuyer = isBuyer && order.status === OrderStatus.SHIPPED;
    const pickedUp = !isBuyer && order.shippingMethod === ShippingMethod.PICKUP && order.status === OrderStatus.PAID;
    if (!shippedByBuyer && !pickedUp) {
      throw new ForbiddenError('You cannot mark this order as delivered', 'ORDER_NOT_DELIVERABLE');
    }

    order.status = OrderStatus.DELIVERED;
    order.deliveredAt = new Date();
    await this.orders.save(order);
    return this.get(userId, orderId);
  }

  // ─── Reading ─────────────────────────────────────────────────────────────

  static async get(userId: string, orderId: string): Promise<OrderView> {
    const order = await this.refreshed(await this.requireParticipant(userId, orderId));
    return (await this.toViews([order]))[0];
  }

  static listPurchases(buyerId: string, query: OrdersQuery) {
    return this.list({ buyerId }, query);
  }

  static listSales(sellerId: string, query: OrdersQuery) {
    return this.list({ sellerId }, query);
  }

  // ─── Admin (read-only) ──────────────────────────────────────────────────

  static async listForAdmin(query: OrdersQuery & { search?: string }) {
    const qb = this.orders
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .orderBy('order.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    if (query.status) qb.andWhere('order.status = :status', { status: query.status });
    if (query.search) qb.andWhere('CAST(order.id AS text) ILIKE :search', { search: `${query.search}%` });

    const [rows, total] = await qb.getManyAndCount();
    return {
      orders: await this.toViews(rows),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  static async getForAdmin(orderId: string): Promise<OrderView> {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: { items: true } });
    if (!order) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    return (await this.toViews([order]))[0];
  }

  // ─── Payment hook ────────────────────────────────────────────────────────

  static async markPaid(charge: PaymentCharge): Promise<void> {
    const order = await this.orders.findOne({ where: { id: charge.reference } });
    if (!order) return;
    if (!canTransition(order.status, OrderStatus.PAID)) {
      log.warn({ orderId: order.id, status: order.status, chargeId: charge.id }, 'payment for an order that cannot be paid');
      return;
    }

    order.status = OrderStatus.PAID;
    order.paidAt = new Date();
    await this.orders.save(order);
    log.info({ orderId: order.id, chargeId: charge.id }, 'order paid');
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private static async list(where: { buyerId: string } | { sellerId: string }, query: OrdersQuery) {
    const [rows, total] = await this.orders.findAndCount({
      where: { ...where, ...(query.status && { status: query.status }) },
      relations: { items: true },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    const orders = await Promise.all(rows.map(order => this.refreshed(order)));
    const visible = query.status ? orders.filter(order => order.status === query.status) : orders;
    return {
      orders: await this.toViews(visible),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  /** 404 for anyone who is not the buyer or the seller, so order ids cannot be probed. */
  private static async requireParticipant(userId: string, orderId: string, as?: 'buyer' | 'seller'): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: { items: true } });
    const allowed = order && (as === 'buyer' ? order.buyerId === userId : as === 'seller' ? order.sellerId === userId : order.buyerId === userId || order.sellerId === userId);
    if (!order || !allowed) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    return order;
  }

  /** Cancels an unpaid order whose Pix or hold time ran out (evaluated whenever the order is read). */
  private static async refreshed(order: Order): Promise<Order> {
    if (order.status !== OrderStatus.AWAITING_PAYMENT) return order;

    const pixExpired = await PaymentsService.expireIfOverdue(order.id);
    const latest = await PaymentsService.latestForReference(order.id);
    const holdOver = Date.now() - order.createdAt.getTime() > ORDER_HOLD_HOURS * 3_600_000;
    if (pixExpired || (holdOver && latest?.status !== 'pending')) {
      await this.cancelAndRestock(order, 'expired');
    }
    return order;
  }

  private static async cancelAndRestock(order: Order, reason: CancelReason): Promise<void> {
    await AppDataSource.transaction(async (manager: EntityManager) => {
      const claimed = await manager.update(
        Order,
        { id: order.id, status: OrderStatus.AWAITING_PAYMENT },
        { status: OrderStatus.CANCELLED, cancelReason: reason },
      );
      if (!claimed.affected) return;

      for (const item of order.items) {
        await manager.increment(Listing, { id: item.listingId }, 'quantity', item.quantity);
      }
    });

    await PaymentsService.cancelPending(order.id);
    order.status = OrderStatus.CANCELLED;
    order.cancelReason = reason;
    log.info({ orderId: order.id, reason }, 'order cancelled');
  }

  private static async toViews(orders: Order[]): Promise<OrderView[]> {
    const people = await IdentityDirectory.userNames([...new Set(orders.flatMap(order => [order.buyerId, order.sellerId]))]);
    const companies = await IdentityDirectory.companyNames([
      ...new Set(orders.map(order => order.companyId).filter((id): id is string => !!id)),
    ]);

    return Promise.all(
      orders.map(async order => {
        const charge = await PaymentsService.latestForReference(order.id);
        return {
          id: order.id,
          status: order.status,
          shippingMethod: order.shippingMethod,
          shippingAddress: order.shippingAddress ?? null,
          subtotalCents: order.subtotalCents,
          shippingCents: order.shippingCents,
          totalCents: order.totalCents,
          trackingCode: order.trackingCode ?? null,
          cancelReason: order.cancelReason ?? null,
          items: order.items.map(item => ({
            id: item.id,
            listingId: item.listingId,
            catalogBookId: item.catalogBookId,
            title: item.title,
            author: item.author,
            isbn: item.isbn ?? null,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
          })),
          buyer: { id: order.buyerId, name: people.get(order.buyerId) ?? '' },
          seller: {
            id: order.sellerId,
            name: (order.companyId && companies.get(order.companyId)) || people.get(order.sellerId) || '',
          },
          payment: charge ? toChargeView(charge) : null,
          paidAt: order.paidAt?.toISOString() ?? null,
          shippedAt: order.shippedAt?.toISOString() ?? null,
          deliveredAt: order.deliveredAt?.toISOString() ?? null,
          createdAt: order.createdAt.toISOString(),
        };
      }),
    );
  }
}
