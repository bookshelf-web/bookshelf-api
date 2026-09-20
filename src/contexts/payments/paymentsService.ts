import { createHmac } from 'crypto';
import { z } from 'zod';
import { AppDataSource } from '../../config/database';
import { env } from '../../config/env';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { contextLogger } from '../../shared/logger';
import { getPaymentGateway } from './guard';
import type { Charge, CreateChargeInput } from './gateway';
import { PaymentCharge } from './models/PaymentCharge';
import { signWebhook, verifyWebhook } from './webhook';

const log = contextLogger('payments');

export const webhookEventSchema = z.object({
  chargeId: z.string().uuid(),
  status: z.enum(['paid', 'failed']),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export type ChargePaidListener = (charge: PaymentCharge) => Promise<void>;

export interface ChargeView {
  id: string;
  simulated: boolean;
  method: 'pix' | 'card';
  status: PaymentCharge['status'];
  amountCents: number;
  reference: string;
  failureReason?: string | null;
  pix?: { code: string; expiresAt: string } | null;
  card?: { brand: string | null; last4: string } | null;
  createdAt: string;
}

export function toChargeView(charge: PaymentCharge): ChargeView {
  return {
    id: charge.id,
    simulated: charge.simulated,
    method: charge.method,
    status: charge.status,
    amountCents: charge.amountCents,
    reference: charge.reference,
    failureReason: charge.failureReason ?? null,
    pix: charge.pixCode ? { code: charge.pixCode, expiresAt: (charge.pixExpiresAt as Date).toISOString() } : null,
    card: charge.cardLast4 ? { brand: charge.cardBrand ?? null, last4: charge.cardLast4 } : null,
    createdAt: charge.createdAt.toISOString(),
  };
}

/** The webhook key is derived from the JWT secret, so there is no extra secret to configure. */
const webhookSecret = (): string => createHmac('sha256', env.JWT_SECRET).update('payments-webhook').digest('hex');

export class PaymentsService {
  private static paidListeners: ChargePaidListener[] = [];

  private static get charges() {
    return AppDataSource.getRepository(PaymentCharge);
  }

  /** Other contexts subscribe here (the marketplace marks an order paid). */
  static onPaid(listener: ChargePaidListener): void {
    this.paidListeners.push(listener);
  }

  static async createCharge(input: CreateChargeInput): Promise<PaymentCharge> {
    const gateway = getPaymentGateway();

    const open = await this.charges.findOne({ where: { reference: input.reference, status: 'pending' } });
    if (open) {
      if (open.method === input.method && open.method === 'pix' && open.pixExpiresAt && open.pixExpiresAt > new Date()) {
        return open;
      }
      open.status = 'expired';
      await this.charges.save(open);
    }

    const created: Charge = gateway.createCharge(input);
    const charge = await this.charges.save(
      this.charges.create({
        id: created.id,
        gateway: created.gateway,
        simulated: created.simulated,
        method: created.method,
        amountCents: created.amountCents,
        status: created.status,
        reference: created.reference,
        failureReason: created.failureReason ?? null,
        pixCode: created.pix?.code ?? null,
        pixExpiresAt: created.pix ? new Date(created.pix.expiresAt) : null,
        cardBrand: created.card?.brand ?? null,
        cardLast4: created.card?.last4 ?? null,
      }),
    );

    log.info({ chargeId: charge.id, method: charge.method, status: charge.status }, 'charge created');
    if (charge.status === 'paid') await this.emitPaid(charge);
    return charge;
  }

  static async getById(id: string): Promise<PaymentCharge> {
    const charge = await this.charges.findOne({ where: { id } });
    if (!charge) throw new NotFoundError('Charge not found', 'CHARGE_NOT_FOUND');
    return charge;
  }

  static async latestForReference(reference: string): Promise<PaymentCharge | null> {
    return this.charges.findOne({ where: { reference }, order: { createdAt: 'DESC' } });
  }

  /** Expires a Pix that was not paid in time. Returns true when it expired just now. */
  static async expireIfOverdue(reference: string, now = new Date()): Promise<boolean> {
    const pending = await this.charges.findOne({ where: { reference, status: 'pending' } });
    if (!pending?.pixExpiresAt || pending.pixExpiresAt > now) return false;
    pending.status = 'expired';
    await this.charges.save(pending);
    return true;
  }

  /** Withdraws a charge that is still waiting (the buyer cancelled the order), so it can no longer be paid. */
  static async cancelPending(reference: string): Promise<void> {
    await this.charges.update({ reference, status: 'pending' }, { status: 'expired' });
  }

  /**
   * The simulator's "Simular pagamento" button. It goes through the same signed webhook a real gateway
   * would call, so the order is paid by the same code path in both cases.
   */
  static async simulatePixPayment(chargeId: string): Promise<PaymentCharge> {
    getPaymentGateway();
    const charge = await this.getById(chargeId);
    if (!charge.simulated || charge.method !== 'pix') {
      throw new BadRequestError('Only a simulated Pix charge can be paid this way', 'NOT_SIMULATED_PIX');
    }

    const body = JSON.stringify({ chargeId, status: 'paid' } satisfies WebhookEvent);
    const timestamp = Math.floor(Date.now() / 1000);
    await this.handleWebhook(body, timestamp, signWebhook(webhookSecret(), timestamp, body));
    return this.getById(chargeId);
  }

  /** Verifies the signature, then applies the event once (a repeated event changes nothing). */
  static async handleWebhook(rawBody: string, timestamp: number, signature: string): Promise<'applied' | 'duplicate'> {
    getPaymentGateway();
    if (!verifyWebhook(webhookSecret(), timestamp, rawBody, signature)) {
      throw new ForbiddenError('Invalid webhook signature', 'INVALID_SIGNATURE');
    }

    let event: WebhookEvent;
    try {
      event = webhookEventSchema.parse(JSON.parse(rawBody));
    } catch {
      throw new BadRequestError('Invalid webhook payload', 'INVALID_WEBHOOK');
    }

    const charge = await this.getById(event.chargeId);
    if (charge.status === event.status) return 'duplicate';
    if (charge.status !== 'pending') {
      throw new ConflictError(`The charge is already ${charge.status}`, 'CHARGE_NOT_PENDING');
    }
    if (charge.pixExpiresAt && charge.pixExpiresAt <= new Date()) {
      charge.status = 'expired';
      await this.charges.save(charge);
      throw new ConflictError('The charge expired', 'CHARGE_EXPIRED');
    }

    charge.status = event.status;
    await this.charges.save(charge);
    log.info({ chargeId: charge.id, status: charge.status }, 'webhook applied');
    if (charge.status === 'paid') await this.emitPaid(charge);
    return 'applied';
  }

  private static async emitPaid(charge: PaymentCharge): Promise<void> {
    for (const listener of this.paidListeners) await listener(charge);
  }
}
