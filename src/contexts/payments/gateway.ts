import { randomUUID } from 'crypto';
import { BadRequestError } from '../../shared/errors';
import { SIMULATED_PIX_KEY, SIMULATED_PIX_RECEIVER, simulatedPixCode } from './pix';
import { evaluateCard, type CardBrand } from './testCards';

export type PaymentMethod = 'pix' | 'card';
export type ChargeStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

/** Largest amount a simulated charge may carry (R$ 10.000,00), as one more guard against misuse. */
export const MAX_AMOUNT_CENTS = 1_000_000;
export const PIX_TTL_MINUTES = 30;

export interface Charge {
  id: string;
  gateway: string;
  /** Always true: nothing this gateway creates can move real money. */
  simulated: true;
  method: PaymentMethod;
  amountCents: number;
  status: ChargeStatus;
  reference: string;
  failureReason?: 'declined' | 'insufficient_funds' | 'not_a_test_card';
  pix?: { code: string; key: string; receiver: string; expiresAt: string };
  card?: { brand: CardBrand | null; last4: string };
  createdAt: string;
}

export interface CreateChargeInput {
  method: PaymentMethod;
  amountCents: number;
  /** The order this charge pays for. */
  reference: string;
  cardNumber?: string;
}

/** The port every gateway implements; only a simulated one exists on purpose. */
export interface PaymentGateway {
  readonly name: string;
  createCharge(input: CreateChargeInput, now?: Date): Charge;
}

export class SimulatedPaymentGateway implements PaymentGateway {
  readonly name = 'simulated';

  createCharge(input: CreateChargeInput, now = new Date()): Charge {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > MAX_AMOUNT_CENTS) {
      throw new BadRequestError('Invalid charge amount', 'INVALID_AMOUNT');
    }

    const id = randomUUID();
    const base = {
      id,
      gateway: this.name,
      simulated: true as const,
      method: input.method,
      amountCents: input.amountCents,
      reference: input.reference,
      createdAt: now.toISOString(),
    };

    if (input.method === 'pix') {
      const expiresAt = new Date(now.getTime() + PIX_TTL_MINUTES * 60_000).toISOString();
      return {
        ...base,
        status: 'pending',
        pix: { code: simulatedPixCode(id), key: SIMULATED_PIX_KEY, receiver: SIMULATED_PIX_RECEIVER, expiresAt },
      };
    }

    const card = evaluateCard(input.cardNumber ?? '');
    const cardInfo = { brand: card.brand, last4: card.last4 };
    if (card.outcome === null) return { ...base, status: 'failed', failureReason: 'not_a_test_card', card: cardInfo };
    if (card.outcome === 'approved') return { ...base, status: 'paid', card: cardInfo };
    return { ...base, status: 'failed', failureReason: card.outcome, card: cardInfo };
  }
}
