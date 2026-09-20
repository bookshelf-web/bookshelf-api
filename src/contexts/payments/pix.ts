/**
 * The simulated Pix code must never be payable. Real "copia e cola" codes are EMV BR Codes: they start
 * with `000201`, carry the `br.gov.bcb.pix` key and end with a CRC16. The simulated code follows none of
 * that, so a bank app rejects it as "not a Pix code".
 */
const SIMULATED_PREFIX = 'SIMULADO-NAO-PAGUE-';

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** True for a string with a valid BR Code CRC16 trailer (`...6304XXXX`). */
export function hasBrCodeChecksum(code: string): boolean {
  if (code.length < 8) return false;
  const payload = code.slice(0, -4);
  return payload.endsWith('6304') && crc16(payload) === code.slice(-4).toUpperCase();
}

/** Anything a bank could plausibly accept: BR Code header, Pix key marker or a valid checksum. */
export function looksLikeBrCode(code: string): boolean {
  return code.startsWith('000201') || code.toLowerCase().includes('br.gov.bcb.pix') || hasBrCodeChecksum(code);
}

export function simulatedPixCode(chargeId: string): string {
  const code = `${SIMULATED_PREFIX}${chargeId.toUpperCase()}`;
  if (looksLikeBrCode(code)) {
    throw new Error('Simulated Pix code must never look like a real BR Code');
  }
  return code;
}

export const SIMULATED_PIX_KEY = 'teste@simulado.invalid';
export const SIMULATED_PIX_RECEIVER = 'LOJA SIMULADA (AMBIENTE DE TESTE)';
