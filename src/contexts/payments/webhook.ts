import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TOLERANCE_SECONDS = 300;

export function signWebhook(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Rejects a bad signature or a timestamp outside the tolerance window (replay protection). */
export function verifyWebhook(
  secret: string,
  timestamp: number,
  body: string,
  signature: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = Buffer.from(signWebhook(secret, timestamp, body), 'hex');
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
