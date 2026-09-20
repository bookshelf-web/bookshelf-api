import { createHmac } from 'crypto';
import request from 'supertest';
import app from '../../../src/app';
import { AppDataSource } from '../../../src/config/database';
import { env } from '../../../src/config/env';
import { looksLikeBrCode } from '../../../src/contexts/payments/pix';
import { signWebhook } from '../../../src/contexts/payments/webhook';
import { ApiClient } from '../../helpers/apiClient';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';

async function signUp(roles: string[]) {
  const api = new ApiClient();
  const response = await api.register(TestDataBuilder.createUser({ roles }));
  api.setToken(response.body.token);
  return { api, user: response.body.user };
}

async function newCatalogBook(): Promise<string> {
  const reader = await signUp(['reader']);
  const response = await reader.api.createBook(TestDataBuilder.createBook());
  return response.body.book.catalogBookId;
}

const listingBody = (catalogBookId: string, overrides: Record<string, unknown> = {}) => ({
  catalogBookId,
  priceCents: 2500,
  condition: 'good',
  quantity: 3,
  shippingFeeCents: 1200,
  pickupAvailable: true,
  ...overrides,
});

const address = {
  recipient: 'Bia Compradora',
  street: 'Rua das Flores',
  number: '10',
  district: 'Centro',
  city: 'Curitiba',
  state: 'PR',
  zip: '80000-000',
};

async function listBook(seller: { api: ApiClient }, overrides: Record<string, unknown> = {}) {
  const response = await seller.api.call('post', '/marketplace/listings', listingBody(await newCatalogBook(), overrides));
  return response.body.listing as { id: string; quantity: number };
}

const order = (buyer: { api: ApiClient }, listingId: string, quantity = 1, method: 'ship' | 'pickup' = 'ship') =>
  buyer.api.call('post', '/marketplace/orders', {
    items: [{ listingId, quantity }],
    shippingMethod: method,
    ...(method === 'ship' && { shippingAddress: address }),
  });

const stockOf = async (api: ApiClient, listingId: string): Promise<number> => {
  const response = await api.call('get', `/marketplace/listings/${listingId}`);
  return response.body.listing.quantity;
};

describe('marketplace', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('listings', () => {
    it('lets a seller list a catalog book, and shows it in the bookstore with the seller name', async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const listing = await listBook(seller);

      const browse = await buyer.api.call('get', '/marketplace/listings');

      expect(browse.status).toBe(200);
      expect(browse.body.listings).toHaveLength(1);
      expect(browse.body.listings[0]).toMatchObject({
        id: listing.id,
        priceCents: 2500,
        seller: { id: seller.user.id, company: false },
      });
      expect(browse.body.listings[0].book.title).toBeTruthy();
    });

    it('only lets sellers create listings', async () => {
      const buyer = await signUp(['buyer']);

      const response = await buyer.api.call('post', '/marketplace/listings', listingBody(await newCatalogBook()));

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ROLE_REQUIRED');
    });

    it('rejects an unknown catalog book and a price below R$ 1,00', async () => {
      const seller = await signUp(['seller']);

      const unknown = await seller.api.call(
        'post',
        '/marketplace/listings',
        listingBody('00000000-0000-4000-8000-000000000000'),
      );
      const cheap = await seller.api.call('post', '/marketplace/listings', listingBody(await newCatalogBook(), { priceCents: 50 }));

      expect(unknown.status).toBe(404);
      expect(cheap.status).toBe(400);
    });

    it('does not let a person sell on behalf of a company they do not belong to', async () => {
      const seller = await signUp(['seller']);

      const response = await seller.api.call(
        'post',
        '/marketplace/listings',
        listingBody(await newCatalogBook(), { companyId: '00000000-0000-4000-8000-000000000000' }),
      );

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('COMPANY_NOT_FOUND');
    });

    it('filters and sorts the bookstore', async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      await listBook(seller, { priceCents: 5000, condition: 'new' });
      await listBook(seller, { priceCents: 1000, condition: 'fair' });

      const cheapFirst = await buyer.api.call('get', '/marketplace/listings?sort=price_asc');
      const onlyNew = await buyer.api.call('get', '/marketplace/listings?condition=new');
      const capped = await buyer.api.call('get', '/marketplace/listings?maxPriceCents=2000');

      expect(cheapFirst.body.listings.map((l: { priceCents: number }) => l.priceCents)).toEqual([1000, 5000]);
      expect(onlyNew.body.listings).toHaveLength(1);
      expect(capped.body.listings).toHaveLength(1);
    });

    it('hides paused listings from others, lets the seller edit them, and removes them', async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const listing = await listBook(seller);

      const paused = await seller.api.call('patch', `/marketplace/listings/${listing.id}`, { status: 'paused' });
      expect(paused.status).toBe(200);
      expect((await buyer.api.call('get', `/marketplace/listings/${listing.id}`)).status).toBe(404);
      expect((await seller.api.call('get', `/marketplace/listings/${listing.id}`)).status).toBe(200);
      expect((await buyer.api.call('get', '/marketplace/listings')).body.listings).toHaveLength(0);

      const foreign = await buyer.api.call('patch', `/marketplace/listings/${listing.id}`, { priceCents: 100 });
      expect(foreign.status).toBe(403);

      expect((await seller.api.call('delete', `/marketplace/listings/${listing.id}`)).status).toBe(204);
      expect((await seller.api.call('get', `/marketplace/listings/${listing.id}`)).status).toBe(404);
    });

    it('lists the seller\'s own listings', async () => {
      const seller = await signUp(['seller']);
      await listBook(seller);

      const mine = await seller.api.call('get', '/marketplace/listings/mine');

      expect(mine.status).toBe(200);
      expect(mine.body.listings).toHaveLength(1);
    });
  });

  describe('placing an order', () => {
    it('reserves the stock and freezes the price, with a flat shipping fee per listing', async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const listing = await listBook(seller, { priceCents: 2500, shippingFeeCents: 1200, quantity: 3 });

      const placed = await order(buyer, listing.id, 2);

      expect(placed.status).toBe(201);
      expect(placed.body.order).toMatchObject({
        status: 'awaiting_payment',
        subtotalCents: 5000,
        shippingCents: 1200,
        totalCents: 6200,
      });
      expect(placed.body.order.items[0]).toMatchObject({ quantity: 2, unitPriceCents: 2500 });
      expect(await stockOf(buyer.api, listing.id)).toBe(1);

      await seller.api.call('patch', `/marketplace/listings/${listing.id}`, { priceCents: 9900 });
      const reloaded = await buyer.api.call('get', `/marketplace/orders/${placed.body.order.id}`);
      expect(reloaded.body.order.items[0].unitPriceCents).toBe(2500);
    });

    it('charges no shipping for a pickup', async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const listing = await listBook(seller);

      const placed = await order(buyer, listing.id, 1, 'pickup');

      expect(placed.body.order).toMatchObject({ shippingCents: 0, totalCents: 2500, shippingAddress: null });
    });

    it('refuses a pickup when the listing does not offer it, and shipping without an address', async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const listing = await listBook(seller, { pickupAvailable: false });

      const pickup = await order(buyer, listing.id, 1, 'pickup');
      const noAddress = await buyer.api.call('post', '/marketplace/orders', {
        items: [{ listingId: listing.id, quantity: 1 }],
        shippingMethod: 'ship',
      });

      expect(pickup.status).toBe(400);
      expect(pickup.body.code).toBe('PICKUP_UNAVAILABLE');
      expect(noAddress.status).toBe(400);
    });

    it('refuses more than the stock, your own listing and mixed sellers', async () => {
      const seller = await signUp(['seller']);
      const other = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const listing = await listBook(seller, { quantity: 1 });
      const otherListing = await listBook(other);

      const tooMany = await order(buyer, listing.id, 2);
      const own = await order(seller, listing.id, 1);
      const mixed = await buyer.api.call('post', '/marketplace/orders', {
        items: [
          { listingId: listing.id, quantity: 1 },
          { listingId: otherListing.id, quantity: 1 },
        ],
        shippingMethod: 'ship',
        shippingAddress: address,
      });

      expect(tooMany.status).toBe(409);
      expect(tooMany.body.code).toBe('INSUFFICIENT_STOCK');
      expect(own.status).toBe(400);
      expect(own.body.code).toBe('SELF_PURCHASE');
      expect(mixed.status).toBe(400);
      expect(mixed.body.code).toBe('MIXED_SELLERS');
      expect(await stockOf(buyer.api, listing.id)).toBe(1);
    });

    it('never oversells the last copy to two buyers at once', async () => {
      const seller = await signUp(['seller']);
      const ana = await signUp(['buyer']);
      const bia = await signUp(['buyer']);
      const listing = await listBook(seller, { quantity: 1 });

      const results = await Promise.all([order(ana, listing.id), order(bia, listing.id)]);

      expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    });

    it('only lets readers-only accounts browse, not buy', async () => {
      const seller = await signUp(['seller']);
      const reader = await signUp(['reader']);
      const listing = await listBook(seller);

      const response = await order(reader, listing.id);

      expect(response.status).toBe(403);
    });

    it('cancels an unpaid order and puts the stock back on sale', async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const listing = await listBook(seller, { quantity: 2 });
      const placed = await order(buyer, listing.id, 2);

      const cancelled = await buyer.api.call('post', `/marketplace/orders/${placed.body.order.id}/cancel`);

      expect(cancelled.body.order).toMatchObject({ status: 'cancelled', cancelReason: 'buyer' });
      expect(await stockOf(buyer.api, listing.id)).toBe(2);

      const again = await buyer.api.call('post', `/marketplace/orders/${placed.body.order.id}/cancel`);
      expect(again.status).toBe(409);
    });

    it('hides an order from people who are neither its buyer nor its seller', async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const stranger = await signUp(['buyer']);
      const placed = await order(buyer, (await listBook(seller)).id);

      const response = await stranger.api.call('get', `/marketplace/orders/${placed.body.order.id}`);

      expect(response.status).toBe(404);
    });
  });

  describe('paying', () => {
    const setup = async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const listing = await listBook(seller, { quantity: 2 });
      const placed = await order(buyer, listing.id);
      return { seller, buyer, listing, orderId: placed.body.order.id as string };
    };

    it('pays with an approved test card and stores only the brand and last four digits', async () => {
      const { buyer, orderId } = await setup();

      const paid = await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, {
        method: 'card',
        cardNumber: '4242 4242 4242 4242',
      });

      expect(paid.status).toBe(200);
      expect(paid.body.order.status).toBe('paid');
      expect(paid.body.order.payment).toMatchObject({ status: 'paid', simulated: true, card: { brand: 'visa', last4: '4242' } });
      expect(JSON.stringify(paid.body)).not.toContain('4242424242424242');

      const stored = await AppDataSource.query('SELECT * FROM payment_charges');
      expect(JSON.stringify(stored)).not.toContain('4242424242424242');
    });

    it.each([
      ['4000000000000002', 'declined'],
      ['4000000000009995', 'insufficient_funds'],
      ['4111111111111111', 'not_a_test_card'],
    ])('leaves the order awaiting payment when card %s fails (%s)', async (cardNumber, reason) => {
      const { buyer, orderId } = await setup();

      const response = await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, { method: 'card', cardNumber });

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe('awaiting_payment');
      expect(response.body.order.payment).toMatchObject({ status: 'failed', failureReason: reason });

      const retry = await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, {
        method: 'card',
        cardNumber: '4242424242424242',
      });
      expect(retry.body.order.status).toBe('paid');
    });

    it('creates a Pix that no bank could recognise, and pays it through the signed webhook', async () => {
      const { buyer, orderId } = await setup();

      const pix = await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, { method: 'pix' });
      const code = pix.body.order.payment.pix.code as string;

      expect(pix.body.order.status).toBe('awaiting_payment');
      expect(code.startsWith('SIMULADO-NAO-PAGUE-')).toBe(true);
      expect(looksLikeBrCode(code)).toBe(false);

      const paid = await buyer.api.call('post', `/marketplace/orders/${orderId}/simulate-pix-payment`);
      expect(paid.body.order.status).toBe('paid');
      expect(paid.body.order.paidAt).toBeTruthy();
    });

    it('reuses the same Pix while it is pending', async () => {
      const { buyer, orderId } = await setup();

      const first = await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, { method: 'pix' });
      const second = await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, { method: 'pix' });

      expect(second.body.order.payment.id).toBe(first.body.order.payment.id);
    });

    it('cannot simulate a Pix that was never created, and cannot pay twice', async () => {
      const { buyer, orderId } = await setup();

      const none = await buyer.api.call('post', `/marketplace/orders/${orderId}/simulate-pix-payment`);
      expect(none.status).toBe(409);

      await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, { method: 'card', cardNumber: '4242424242424242' });
      const twice = await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, { method: 'pix' });
      expect(twice.status).toBe(409);
      expect(twice.body.code).toBe('ORDER_NOT_PAYABLE');
    });

    it('does not let another buyer pay for the order', async () => {
      const { orderId } = await setup();
      const stranger = await signUp(['buyer']);

      const response = await stranger.api.call('post', `/marketplace/orders/${orderId}/pay`, { method: 'pix' });

      expect(response.status).toBe(404);
    });

    it('expires an unpaid Pix, cancels the order and returns the stock', async () => {
      const { buyer, listing, orderId } = await setup();
      await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, { method: 'pix' });
      await AppDataSource.query(`UPDATE payment_charges SET pix_expires_at = now() - interval '1 minute'`);

      const reloaded = await buyer.api.call('get', `/marketplace/orders/${orderId}`);

      expect(reloaded.body.order).toMatchObject({ status: 'cancelled', cancelReason: 'expired' });
      expect(reloaded.body.order.payment.status).toBe('expired');
      expect(await stockOf(buyer.api, listing.id)).toBe(2);
    });

    it('cancels an order nobody paid within the hold time', async () => {
      const { buyer, listing, orderId } = await setup();
      await AppDataSource.query(`UPDATE orders SET created_at = now() - interval '25 hours'`);

      const reloaded = await buyer.api.call('get', `/marketplace/orders/${orderId}`);

      expect(reloaded.body.order.status).toBe('cancelled');
      expect(await stockOf(buyer.api, listing.id)).toBe(2);
    });

    it('withdraws a pending Pix when the buyer cancels', async () => {
      const { buyer, orderId } = await setup();
      const pix = await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, { method: 'pix' });

      const cancelled = await buyer.api.call('post', `/marketplace/orders/${orderId}/cancel`);

      expect(cancelled.body.order.payment.status).toBe('expired');
      const late = await buyer.api.call('post', `/marketplace/orders/${orderId}/simulate-pix-payment`);
      expect(late.status).toBe(409);
      expect(pix.body.order.payment.id).toBeTruthy();
    });
  });

  describe('payment webhook', () => {
    const webhook = (chargeId: string, timestamp = Math.floor(Date.now() / 1000), secretOverride?: string) => {
      const body = JSON.stringify({ chargeId, status: 'paid' });
      const secret =
        secretOverride ?? createHmac('sha256', env.JWT_SECRET).update('payments-webhook').digest('hex');
      return request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('X-Simulated-Timestamp', String(timestamp))
        .set('X-Simulated-Signature', signWebhook(secret, timestamp, body))
        .send(body);
    };

    const pendingPix = async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const placed = await order(buyer, (await listBook(seller)).id);
      const pix = await buyer.api.call('post', `/marketplace/orders/${placed.body.order.id}/pay`, { method: 'pix' });
      return { buyer, orderId: placed.body.order.id as string, chargeId: pix.body.order.payment.id as string };
    };

    it('applies a correctly signed event once, and treats a repeat as a no-op', async () => {
      const { buyer, orderId, chargeId } = await pendingPix();

      const first = await webhook(chargeId);
      const repeat = await webhook(chargeId);

      expect(first.body.result).toBe('applied');
      expect(repeat.body.result).toBe('duplicate');
      const paid = await buyer.api.call('get', `/marketplace/orders/${orderId}`);
      expect(paid.body.order.status).toBe('paid');
    });

    it('rejects a wrong signature, a stale timestamp and a missing signature', async () => {
      const { chargeId, buyer, orderId } = await pendingPix();

      const forged = await webhook(chargeId, undefined, 'not-the-secret');
      const stale = await webhook(chargeId, Math.floor(Date.now() / 1000) - 3600);
      const unsigned = await request(app).post('/api/payments/webhook').send({ chargeId, status: 'paid' });

      expect(forged.status).toBe(403);
      expect(stale.status).toBe(403);
      expect(unsigned.status).toBe(400);
      const still = await buyer.api.call('get', `/marketplace/orders/${orderId}`);
      expect(still.body.order.status).toBe('awaiting_payment');
    });

    it('rejects a payload that is not a valid event', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const secret = createHmac('sha256', env.JWT_SECRET).update('payments-webhook').digest('hex');
      const body = JSON.stringify({ hello: 'world' });

      const response = await request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('X-Simulated-Timestamp', String(timestamp))
        .set('X-Simulated-Signature', signWebhook(secret, timestamp, body))
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_WEBHOOK');
    });
  });

  describe('fulfilment', () => {
    const paidOrder = async (method: 'ship' | 'pickup' = 'ship') => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const listing = await listBook(seller);
      const placed = await order(buyer, listing.id, 1, method);
      const orderId = placed.body.order.id as string;
      await buyer.api.call('post', `/marketplace/orders/${orderId}/pay`, { method: 'card', cardNumber: '4242424242424242' });
      return { seller, buyer, orderId };
    };

    it('walks a shipped order from paid to shipped to delivered', async () => {
      const { seller, buyer, orderId } = await paidOrder();

      const sales = await seller.api.call('get', '/marketplace/sales');
      expect(sales.body.orders).toHaveLength(1);
      expect(sales.body.orders[0].shippingAddress.city).toBe('Curitiba');

      const shipped = await seller.api.call('post', `/marketplace/orders/${orderId}/ship`, { trackingCode: 'BR123456789' });
      expect(shipped.body.order).toMatchObject({ status: 'shipped', trackingCode: 'BR123456789' });

      const delivered = await buyer.api.call('post', `/marketplace/orders/${orderId}/deliver`);
      expect(delivered.body.order.status).toBe('delivered');
      expect(delivered.body.order.deliveredAt).toBeTruthy();
    });

    it('does not ship an unpaid order, ship for a stranger, or deliver before shipping', async () => {
      const seller = await signUp(['seller']);
      const buyer = await signUp(['buyer']);
      const placed = await order(buyer, (await listBook(seller)).id);
      const orderId = placed.body.order.id as string;

      const unpaid = await seller.api.call('post', `/marketplace/orders/${orderId}/ship`, { trackingCode: 'BR123' });
      expect(unpaid.status).toBe(409);
      expect(unpaid.body.code).toBe('ORDER_NOT_SHIPPABLE');

      const byBuyer = await buyer.api.call('post', `/marketplace/orders/${orderId}/ship`, { trackingCode: 'BR123' });
      expect(byBuyer.status).toBe(403);

      const early = await buyer.api.call('post', `/marketplace/orders/${orderId}/deliver`);
      expect(early.status).toBe(403);
    });

    it('lets the seller hand over a paid pickup, and never ships it', async () => {
      const { seller, buyer, orderId } = await paidOrder('pickup');

      const ship = await seller.api.call('post', `/marketplace/orders/${orderId}/ship`, { trackingCode: 'BR123' });
      expect(ship.body.code).toBe('ORDER_IS_PICKUP');

      const byBuyer = await buyer.api.call('post', `/marketplace/orders/${orderId}/deliver`);
      expect(byBuyer.status).toBe(403);

      const handed = await seller.api.call('post', `/marketplace/orders/${orderId}/deliver`);
      expect(handed.body.order.status).toBe('delivered');
    });

    it('lists my purchases, filtered by status', async () => {
      const { buyer } = await paidOrder();

      const paid = await buyer.api.call('get', '/marketplace/orders?status=paid');
      const cancelled = await buyer.api.call('get', '/marketplace/orders?status=cancelled');

      expect(paid.body.orders).toHaveLength(1);
      expect(cancelled.body.orders).toHaveLength(0);
    });
  });
});
