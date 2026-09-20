import { Request, Response, Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler';
import { BadRequestError } from '../../shared/errors';
import { withContext } from '../../shared/requestContext';
import { PaymentsService } from './paymentsService';

export const paymentsRoutes = Router();
paymentsRoutes.use(withContext('payments'));

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Receive a signed payment event from the simulated gateway
 *     tags: [Payments]
 *     description: >
 *       Test environment only. The body is `{ chargeId, status }` and must be signed with the
 *       `X-Simulated-Timestamp` and `X-Simulated-Signature` headers (HMAC-SHA256 of `timestamp.body`).
 *     responses:
 *       200: { description: Event applied, or already applied }
 *       403: { description: Invalid signature }
 */
paymentsRoutes.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const timestamp = Number(req.header('x-simulated-timestamp'));
    const signature = req.header('x-simulated-signature');
    if (!signature) throw new BadRequestError('Missing webhook signature', 'INVALID_SIGNATURE');

    const result = await PaymentsService.handleWebhook(JSON.stringify(req.body), timestamp, signature);
    res.json({ result });
  }),
);
