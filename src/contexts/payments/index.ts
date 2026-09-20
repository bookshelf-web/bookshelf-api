// Public surface of the payments context. Other contexts may import only from here.
import { env } from '../../config/env';
import { AppError } from '../../shared/errors';
import { SimulatedPaymentGateway, type PaymentGateway } from './gateway';

export { SimulatedPaymentGateway, MAX_AMOUNT_CENTS, PIX_TTL_MINUTES } from './gateway';
export type { Charge, ChargeStatus, CreateChargeInput, PaymentGateway, PaymentMethod } from './gateway';
export { signWebhook, verifyWebhook } from './webhook';
export { TEST_CARD_NUMBERS } from './testCards';

export class PaymentsDisabledError extends AppError {
  readonly statusCode = 503;
  readonly code = 'PAYMENTS_DISABLED';

  constructor() {
    super('Simulated payments are disabled in this environment');
  }
}

/** The simulated gateway is refused in production unless ALLOW_SIMULATED_PAYMENTS=true was set on purpose. */
export function getPaymentGateway(): PaymentGateway {
  if (!env.simulatedPaymentsEnabled) throw new PaymentsDisabledError();
  return new SimulatedPaymentGateway();
}
