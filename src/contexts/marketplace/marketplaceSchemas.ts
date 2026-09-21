import { z } from 'zod';
import { ListingCondition, ListingStatus } from './models/Listing';
import { OrderStatus, ShippingMethod } from './models/Order';

const page = z.coerce.number().int().positive().default(1);
const limit = z.coerce.number().int().positive().max(100).default(20);
const cents = z.number().int().min(0).max(1_000_000);

export const idParamsSchema = z.object({ id: z.string().uuid('Invalid id') });

export const createListingSchema = z.object({
  catalogBookId: z.string().uuid(),
  priceCents: cents.min(100, 'The minimum price is R$ 1,00'),
  condition: z.nativeEnum(ListingCondition),
  quantity: z.number().int().min(1).max(999),
  shippingFeeCents: cents.default(0),
  pickupAvailable: z.boolean().default(false),
  pickupNote: z.string().trim().max(255).nullish(),
  description: z.string().trim().max(2000).nullish(),
  /** Sell on behalf of a verified company instead of as a person. */
  companyId: z.string().uuid().nullish(),
});

export const updateListingSchema = z
  .object({
    priceCents: cents.min(100),
    condition: z.nativeEnum(ListingCondition),
    quantity: z.number().int().min(0).max(999),
    shippingFeeCents: cents,
    pickupAvailable: z.boolean(),
    pickupNote: z.string().trim().max(255).nullable(),
    description: z.string().trim().max(2000).nullable(),
    status: z.enum([ListingStatus.ACTIVE, ListingStatus.PAUSED]),
  })
  .partial()
  .refine(value => Object.keys(value).length > 0, 'Provide at least one field to update');

export const listingsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  isbn: z.string().trim().min(1).optional(),
  condition: z.nativeEnum(ListingCondition).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  page,
  limit,
});

export const myListingsQuerySchema = z.object({ page, limit });

const addressSchema = z.object({
  recipient: z.string().trim().min(1).max(255),
  street: z.string().trim().min(1).max(255),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(100).nullish(),
  district: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().length(2).toUpperCase(),
  zip: z.string().transform(value => value.replace(/\D/g, '')).pipe(z.string().length(8, 'Invalid zip code')),
});

export const createOrderSchema = z
  .object({
    items: z
      .array(z.object({ listingId: z.string().uuid(), quantity: z.number().int().min(1).max(999) }))
      .min(1, 'The order needs at least one item')
      .max(50),
    shippingMethod: z.nativeEnum(ShippingMethod),
    shippingAddress: addressSchema.nullish(),
  })
  .refine(value => value.shippingMethod === ShippingMethod.PICKUP || !!value.shippingAddress, {
    message: 'A shipping address is required to ship the order',
    path: ['shippingAddress'],
  });

export const payOrderSchema = z
  .object({
    method: z.enum(['pix', 'card']),
    cardNumber: z.string().trim().min(8).max(23).optional(),
  })
  .refine(value => value.method === 'pix' || !!value.cardNumber, {
    message: 'The card number is required',
    path: ['cardNumber'],
  });

export const shipOrderSchema = z.object({ trackingCode: z.string().trim().min(3).max(60) });

export const ordersQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  page,
  limit,
});

export const adminOrdersQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  search: z.string().trim().min(1).max(36).optional(),
  page,
  limit,
});

export const adminListingsQuerySchema = z.object({ status: z.nativeEnum(ListingStatus).optional(), page, limit });

export const removeListingSchema = z.object({ reason: z.string().trim().min(1).max(500).optional() });

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type ListingsQuery = z.infer<typeof listingsQuerySchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type PayOrderInput = z.infer<typeof payOrderSchema>;
