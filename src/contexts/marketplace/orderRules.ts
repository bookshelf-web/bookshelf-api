import { OrderStatus, ShippingMethod } from './models/Order';

export interface PricedLine {
  unitPriceCents: number;
  quantity: number;
  shippingFeeCents: number;
}

export interface OrderTotals {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

/** Shipping is a flat fee per listing (not per copy); pickup is free. */
export function calculateTotals(lines: PricedLine[], method: ShippingMethod): OrderTotals {
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const shippingCents = method === ShippingMethod.PICKUP ? 0 : lines.reduce((sum, line) => sum + line.shippingFeeCents, 0);
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.DELIVERED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
