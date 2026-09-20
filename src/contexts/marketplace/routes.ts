import { Request, Response, Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { requireRole } from '../../middlewares/requireRole';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import { withContext } from '../../shared/requestContext';
import { Role } from '../../shared/roles';
import { PaymentsService } from '../payments';
import { ListingsService } from './listingsService';
import {
  createListingSchema,
  createOrderSchema,
  idParamsSchema,
  listingsQuerySchema,
  myListingsQuerySchema,
  ordersQuerySchema,
  payOrderSchema,
  shipOrderSchema,
  updateListingSchema,
} from './marketplaceSchemas';
import { OrdersService } from './ordersService';

// A paid charge (card, or a Pix confirmed by the webhook) marks its order as paid.
PaymentsService.onPaid(charge => OrdersService.markPaid(charge));

const userId = (req: Request): string => req.userId as string;

const marketplaceRoutes = Router();
marketplaceRoutes.use(withContext('marketplace'), authMiddleware);

const buyer = requireRole(Role.BUYER, Role.SELLER);
const seller = requireRole(Role.SELLER);

/**
 * @swagger
 * /api/marketplace/listings:
 *   get:
 *     summary: Browse the second-hand bookstore
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: A page of active listings }
 *   post:
 *     summary: Put a catalog book up for sale (seller)
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: The listing }
 */
marketplaceRoutes.get(
  '/listings',
  validate({ query: listingsQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await ListingsService.search(listingsQuerySchema.parse(req.query)));
  }),
);

marketplaceRoutes.post(
  '/listings',
  seller,
  validate({ body: createListingSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ message: 'Listing created', listing: await ListingsService.create(userId(req), req.body) });
  }),
);

/**
 * @swagger
 * /api/marketplace/listings/mine:
 *   get:
 *     summary: My listings (seller)
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: A page of my active and paused listings }
 */
marketplaceRoutes.get(
  '/listings/mine',
  seller,
  validate({ query: myListingsQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = myListingsQuerySchema.parse(req.query);
    res.json(await ListingsService.listMine(userId(req), page, limit));
  }),
);

/**
 * @swagger
 * /api/marketplace/listings/{id}:
 *   get:
 *     summary: One listing
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The listing }
 *   patch:
 *     summary: Change a listing (its seller)
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The updated listing }
 *   delete:
 *     summary: Take a listing down (its seller)
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: Removed }
 */
marketplaceRoutes.get(
  '/listings/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ listing: await ListingsService.getVisible(req.params.id, userId(req)) });
  }),
);

marketplaceRoutes.patch(
  '/listings/:id',
  seller,
  validate({ params: idParamsSchema, body: updateListingSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Listing updated', listing: await ListingsService.update(userId(req), req.params.id, req.body) });
  }),
);

marketplaceRoutes.delete(
  '/listings/:id',
  seller,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await ListingsService.remove(userId(req), req.params.id);
    res.status(204).send();
  }),
);

/**
 * @swagger
 * /api/marketplace/orders:
 *   get:
 *     summary: My purchases
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: A page of orders }
 *   post:
 *     summary: Place an order with a single seller; stock is reserved until it is paid or cancelled
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: The order, awaiting payment }
 */
marketplaceRoutes.get(
  '/orders',
  buyer,
  validate({ query: ordersQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await OrdersService.listPurchases(userId(req), ordersQuerySchema.parse(req.query)));
  }),
);

marketplaceRoutes.post(
  '/orders',
  buyer,
  validate({ body: createOrderSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ message: 'Order created', order: await OrdersService.create(userId(req), req.body) });
  }),
);

/**
 * @swagger
 * /api/marketplace/sales:
 *   get:
 *     summary: Orders placed with me (seller)
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: A page of orders }
 */
marketplaceRoutes.get(
  '/sales',
  seller,
  validate({ query: ordersQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await OrdersService.listSales(userId(req), ordersQuerySchema.parse(req.query)));
  }),
);

/**
 * @swagger
 * /api/marketplace/orders/{id}:
 *   get:
 *     summary: One order (its buyer or seller)
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The order }
 */
marketplaceRoutes.get(
  '/orders/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ order: await OrdersService.get(userId(req), req.params.id) });
  }),
);

/**
 * @swagger
 * /api/marketplace/orders/{id}/pay:
 *   post:
 *     summary: Pay with the simulated gateway (Pix or a test card). Test environment only.
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The order with its charge; a declined card leaves it awaiting payment }
 */
marketplaceRoutes.post(
  '/orders/:id/pay',
  buyer,
  validate({ params: idParamsSchema, body: payOrderSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ order: await OrdersService.pay(userId(req), req.params.id, req.body) });
  }),
);

/**
 * @swagger
 * /api/marketplace/orders/{id}/simulate-pix-payment:
 *   post:
 *     summary: Confirm the pending simulated Pix, as the gateway webhook would
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The paid order }
 */
marketplaceRoutes.post(
  '/orders/:id/simulate-pix-payment',
  buyer,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ order: await OrdersService.simulatePixPayment(userId(req), req.params.id) });
  }),
);

/**
 * @swagger
 * /api/marketplace/orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order that is still awaiting payment; its stock goes back on sale
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The cancelled order }
 */
marketplaceRoutes.post(
  '/orders/:id/cancel',
  buyer,
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ order: await OrdersService.cancel(userId(req), req.params.id) });
  }),
);

/**
 * @swagger
 * /api/marketplace/orders/{id}/ship:
 *   post:
 *     summary: Mark a paid order as shipped, with its tracking code (seller)
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The shipped order }
 */
marketplaceRoutes.post(
  '/orders/:id/ship',
  seller,
  validate({ params: idParamsSchema, body: shipOrderSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ order: await OrdersService.ship(userId(req), req.params.id, req.body.trackingCode) });
  }),
);

/**
 * @swagger
 * /api/marketplace/orders/{id}/deliver:
 *   post:
 *     summary: Confirm delivery (the buyer of a shipped order, or the seller handing over a pickup)
 *     tags: [Marketplace]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The delivered order }
 */
marketplaceRoutes.post(
  '/orders/:id/deliver',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ order: await OrdersService.deliver(userId(req), req.params.id) });
  }),
);

export default marketplaceRoutes;
