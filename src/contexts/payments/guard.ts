import { env } from '../../config/env';
import { AppError } from '../../shared/errors';
import { SimulatedPaymentGateway, type PaymentGateway } from './gateway';

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
