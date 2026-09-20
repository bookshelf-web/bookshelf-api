import { crc16, hasBrCodeChecksum, looksLikeBrCode, simulatedPixCode } from '../../../src/contexts/payments/pix';
import { evaluateCard, TEST_CARD_NUMBERS } from '../../../src/contexts/payments/testCards';
import { signWebhook, verifyWebhook } from '../../../src/contexts/payments/webhook';
import { MAX_AMOUNT_CENTS, PIX_TTL_MINUTES, SimulatedPaymentGateway } from '../../../src/contexts/payments/gateway';

/** A structurally valid BR Code, built the way a real one is, to prove the detector recognises it. */
function realisticBrCode(): string {
  const body =
    '00020126360014br.gov.bcb.pix0114+5511999999999520400005303986540510.005802BR5909FULANO6009SAO PAULO62070503***6304';
  return `${body}${crc16(body)}`;
}

describe('Pix code', () => {
  it('detects a real-looking BR Code (so the guard is meaningful)', () => {
    const code = realisticBrCode();
    expect(hasBrCodeChecksum(code)).toBe(true);
    expect(looksLikeBrCode(code)).toBe(true);
  });

  it('detects the BR Code header and the Pix key marker on their own', () => {
    expect(looksLikeBrCode('000201anything')).toBe(true);
    expect(looksLikeBrCode('xx BR.GOV.BCB.PIX xx')).toBe(true);
  });

  it('never produces a string a bank could accept', () => {
    for (let i = 0; i < 200; i++) {
      const code = simulatedPixCode(`${i}-abcd-${i * 7}`);
      expect(code.startsWith('SIMULADO-NAO-PAGUE-')).toBe(true);
      expect(looksLikeBrCode(code)).toBe(false);
      expect(hasBrCodeChecksum(code)).toBe(false);
      expect(code.startsWith('000201')).toBe(false);
    }
  });

  it('has no checksum for very short input', () => {
    expect(hasBrCodeChecksum('63041')).toBe(false);
  });
});

describe('test cards', () => {
  it('knows the outcome of each test number, ignoring separators', () => {
    expect(evaluateCard('4242 4242 4242 4242')).toEqual({ outcome: 'approved', brand: 'visa', last4: '4242' });
    expect(evaluateCard('5555-5555-5555-4444').outcome).toBe('approved');
    expect(evaluateCard('4000000000000002').outcome).toBe('declined');
    expect(evaluateCard('4000000000009995').outcome).toBe('insufficient_funds');
  });

  it('refuses any other number, even one with a valid Luhn checksum', () => {
    const luhnValid = '4111111111111111';
    expect(TEST_CARD_NUMBERS).not.toContain(luhnValid);
    expect(evaluateCard(luhnValid)).toEqual({ outcome: null, brand: null, last4: '1111' });
    expect(evaluateCard('').outcome).toBeNull();
  });

  it('only exposes the last four digits', () => {
    expect(JSON.stringify(evaluateCard('4111111111111111'))).not.toContain('411111111111');
  });
});

describe('SimulatedPaymentGateway', () => {
  const gateway = new SimulatedPaymentGateway();
  const now = new Date('2026-01-01T12:00:00.000Z');

  it('creates a pending Pix charge with a non-payable code that expires', () => {
    const charge = gateway.createCharge({ method: 'pix', amountCents: 2500, reference: 'order-1' }, now);

    expect(charge).toMatchObject({ simulated: true, gateway: 'simulated', status: 'pending', method: 'pix' });
    expect(looksLikeBrCode(charge.pix?.code ?? '')).toBe(false);
    expect(charge.pix?.key.endsWith('.invalid')).toBe(true);
    expect(new Date(charge.pix?.expiresAt ?? '').getTime() - now.getTime()).toBe(PIX_TTL_MINUTES * 60_000);
  });

  it('pays with an approved test card and keeps only brand and last four', () => {
    const charge = gateway.createCharge(
      { method: 'card', amountCents: 1000, reference: 'o', cardNumber: '4242424242424242' },
      now,
    );

    expect(charge.status).toBe('paid');
    expect(charge.card).toEqual({ brand: 'visa', last4: '4242' });
    expect(JSON.stringify(charge)).not.toContain('4242424242424242');
  });

  it.each([
    ['4000000000000002', 'declined'],
    ['4000000000009995', 'insufficient_funds'],
    ['4111111111111111', 'not_a_test_card'],
  ])('fails card %s with %s', (cardNumber, failureReason) => {
    const charge = gateway.createCharge({ method: 'card', amountCents: 1000, reference: 'o', cardNumber }, now);

    expect(charge).toMatchObject({ status: 'failed', failureReason });
  });

  it('treats a missing card number as not a test card', () => {
    expect(gateway.createCharge({ method: 'card', amountCents: 1000, reference: 'o' }).failureReason).toBe(
      'not_a_test_card',
    );
  });

  it.each([0, -5, 1.5, MAX_AMOUNT_CENTS + 1, Number.NaN])('rejects the amount %s', amountCents => {
    expect(() => gateway.createCharge({ method: 'pix', amountCents, reference: 'o' })).toThrow('Invalid charge amount');
  });
});

describe('webhook signature', () => {
  const secret = 'shhh';
  const body = JSON.stringify({ chargeId: 'c1', status: 'paid' });
  const timestamp = 1_800_000_000;

  it('accepts a correct signature', () => {
    expect(verifyWebhook(secret, timestamp, body, signWebhook(secret, timestamp, body), timestamp)).toBe(true);
  });

  it('rejects a tampered body, a wrong secret and a malformed signature', () => {
    const signature = signWebhook(secret, timestamp, body);
    expect(verifyWebhook(secret, timestamp, body.replace('paid', 'refunded'), signature, timestamp)).toBe(false);
    expect(verifyWebhook('other', timestamp, body, signature, timestamp)).toBe(false);
    expect(verifyWebhook(secret, timestamp, body, 'zz', timestamp)).toBe(false);
  });

  it('rejects a replay outside the tolerance window', () => {
    const signature = signWebhook(secret, timestamp, body);
    expect(verifyWebhook(secret, timestamp, body, signature, timestamp + 301)).toBe(false);
    expect(verifyWebhook(secret, timestamp, body, signature, timestamp + 299)).toBe(true);
    expect(verifyWebhook(secret, Number.NaN, body, signature, timestamp)).toBe(false);
  });
});
