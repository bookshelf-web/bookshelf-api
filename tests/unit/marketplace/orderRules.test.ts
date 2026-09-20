import { OrderStatus, ShippingMethod } from '../../../src/contexts/marketplace/models/Order';
import { calculateTotals, canTransition } from '../../../src/contexts/marketplace/orderRules';
import {
  createListingSchema,
  createOrderSchema,
  payOrderSchema,
  updateListingSchema,
} from '../../../src/contexts/marketplace/marketplaceSchemas';

describe('calculateTotals', () => {
  const lines = [
    { unitPriceCents: 2500, quantity: 2, shippingFeeCents: 1200 },
    { unitPriceCents: 1000, quantity: 1, shippingFeeCents: 800 },
  ];

  it('charges one flat shipping fee per listing, however many copies are bought', () => {
    expect(calculateTotals(lines, ShippingMethod.SHIP)).toEqual({
      subtotalCents: 6000,
      shippingCents: 2000,
      totalCents: 8000,
    });
  });

  it('charges no shipping for a pickup', () => {
    expect(calculateTotals(lines, ShippingMethod.PICKUP)).toEqual({
      subtotalCents: 6000,
      shippingCents: 0,
      totalCents: 6000,
    });
  });
});

describe('canTransition', () => {
  it.each([
    [OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID],
    [OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED],
    [OrderStatus.PAID, OrderStatus.SHIPPED],
    [OrderStatus.PAID, OrderStatus.DELIVERED],
    [OrderStatus.SHIPPED, OrderStatus.DELIVERED],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    [OrderStatus.PAID, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED, OrderStatus.PAID],
    [OrderStatus.DELIVERED, OrderStatus.SHIPPED],
    [OrderStatus.CANCELLED, OrderStatus.PAID],
    [OrderStatus.AWAITING_PAYMENT, OrderStatus.SHIPPED],
  ])('forbids %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe('marketplace schemas', () => {
  const id = '11111111-1111-4111-8111-111111111111';

  it('requires a price of at least R$ 1,00 and a quantity of at least one', () => {
    const base = { catalogBookId: id, condition: 'good', quantity: 1, priceCents: 100 };
    expect(createListingSchema.safeParse(base).success).toBe(true);
    expect(createListingSchema.safeParse({ ...base, priceCents: 99 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...base, condition: 'mint' }).success).toBe(false);
  });

  it('needs at least one field to update, and cannot set the status to removed', () => {
    expect(updateListingSchema.safeParse({}).success).toBe(false);
    expect(updateListingSchema.safeParse({ status: 'removed' }).success).toBe(false);
    expect(updateListingSchema.safeParse({ status: 'paused' }).success).toBe(true);
  });

  it('requires an address to ship, and normalises the zip code', () => {
    const items = [{ listingId: id, quantity: 1 }];
    expect(createOrderSchema.safeParse({ items, shippingMethod: 'ship' }).success).toBe(false);
    expect(createOrderSchema.safeParse({ items, shippingMethod: 'pickup' }).success).toBe(true);

    const parsed = createOrderSchema.parse({
      items,
      shippingMethod: 'ship',
      shippingAddress: {
        recipient: 'A',
        street: 'B',
        number: '1',
        district: 'C',
        city: 'D',
        state: 'pr',
        zip: '80000-000',
      },
    });
    expect(parsed.shippingAddress).toMatchObject({ zip: '80000000', state: 'PR' });
    expect(createOrderSchema.safeParse({ items: [], shippingMethod: 'pickup' }).success).toBe(false);
  });

  it('requires the card number only for card payments', () => {
    expect(payOrderSchema.safeParse({ method: 'pix' }).success).toBe(true);
    expect(payOrderSchema.safeParse({ method: 'card' }).success).toBe(false);
    expect(payOrderSchema.safeParse({ method: 'card', cardNumber: '4242424242424242' }).success).toBe(true);
  });
});
