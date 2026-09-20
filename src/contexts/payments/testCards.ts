export type CardOutcome = 'approved' | 'declined' | 'insufficient_funds';

export type CardBrand = 'visa' | 'mastercard';

const TEST_CARDS: Record<string, { outcome: CardOutcome; brand: CardBrand }> = {
  '4242424242424242': { outcome: 'approved', brand: 'visa' },
  '5555555555554444': { outcome: 'approved', brand: 'mastercard' },
  '4000000000000002': { outcome: 'declined', brand: 'visa' },
  '4000000000009995': { outcome: 'insufficient_funds', brand: 'visa' },
};

export interface CardEvaluation {
  /** `null` when the number is not a known test card: it is refused without further processing. */
  outcome: CardOutcome | null;
  brand: CardBrand | null;
  last4: string;
}

/**
 * Only well-known test numbers are accepted, so a real card typed by mistake is refused up front.
 * Only the brand and the last four digits ever leave this function.
 */
export function evaluateCard(rawNumber: string): CardEvaluation {
  const digits = rawNumber.replace(/[\s-]/g, '');
  const known = TEST_CARDS[digits];
  return { outcome: known?.outcome ?? null, brand: known?.brand ?? null, last4: digits.slice(-4) };
}

export const TEST_CARD_NUMBERS = Object.keys(TEST_CARDS);
