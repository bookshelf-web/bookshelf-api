/**
 * ISBN helpers. The catalog identifies a book by its ISBN-13, so every ISBN (10 or 13,
 * with or without hyphens) is validated and normalised to 13 digits.
 */

const stripSeparators = (value: string): string => value.replace(/[\s-]/g, '').toUpperCase();

function isbn10CheckDigit(nineDigits: string): string {
  const sum = nineDigits.split('').reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
  const remainder = (11 - (sum % 11)) % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

function isbn13CheckDigit(twelveDigits: string): string {
  const sum = twelveDigits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

export function isValidIsbn10(value: string): boolean {
  const isbn = stripSeparators(value);
  return /^\d{9}[\dX]$/.test(isbn) && isbn10CheckDigit(isbn.slice(0, 9)) === isbn[9];
}

export function isValidIsbn13(value: string): boolean {
  const isbn = stripSeparators(value);
  return /^97[89]\d{10}$/.test(isbn) && isbn13CheckDigit(isbn.slice(0, 12)) === isbn[12];
}

/** Returns the ISBN-13 for a valid ISBN-10 or ISBN-13, or `null` when the input is not an ISBN. */
export function normalizeIsbn(value: string | null | undefined): string | null {
  if (!value) return null;
  const isbn = stripSeparators(value);

  if (isValidIsbn13(isbn)) return isbn;
  if (isValidIsbn10(isbn)) {
    const twelve = `978${isbn.slice(0, 9)}`;
    return `${twelve}${isbn13CheckDigit(twelve)}`;
  }
  return null;
}
