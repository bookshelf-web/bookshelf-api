/** CNPJ (Brazilian company tax id) helpers. Stored and compared as 14 digits. */

export function normalizeCnpj(value: string): string {
  return value.replace(/\D/g, '');
}

const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, ...FIRST_WEIGHTS];

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  // A sequence of one repeated digit passes the checksum but is not a real CNPJ.
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const base = cnpj.slice(0, 12);
  const first = checkDigit(base, FIRST_WEIGHTS);
  const second = checkDigit(`${base}${first}`, SECOND_WEIGHTS);
  return cnpj.endsWith(`${first}${second}`);
}

export function formatCnpj(value: string): string {
  const cnpj = normalizeCnpj(value);
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
