import { isValidIsbn10, isValidIsbn13, normalizeIsbn } from '../../../src/contexts/catalog/isbn';
import { dedupeKeyFor, normalizeText } from '../../../src/contexts/catalog/catalogService';

describe('isValidIsbn13', () => {
  it.each(['9780132350884', '978-0-13-235088-4', '9781234567897', '978 0 13 235088 4'])('accepts %s', value => {
    expect(isValidIsbn13(value)).toBe(true);
  });

  it.each(['9780132350885', '1234567890123', '978013235088', '97801323508845', 'abc', ''])('rejects %s', value => {
    expect(isValidIsbn13(value)).toBe(false);
  });
});

describe('isValidIsbn10', () => {
  it.each(['0132350882', '0-13-235088-2', '080442957X', '080442957x'])('accepts %s', value => {
    expect(isValidIsbn10(value)).toBe(true);
  });

  it.each(['0132350883', '013235088', '01323508822', 'ABCDEFGHIJ', ''])('rejects %s', value => {
    expect(isValidIsbn10(value)).toBe(false);
  });
});

describe('normalizeIsbn', () => {
  it('returns an ISBN-13 unchanged, without separators', () => {
    expect(normalizeIsbn('978-0-13-235088-4')).toBe('9780132350884');
  });

  it('converts an ISBN-10 to its ISBN-13', () => {
    expect(normalizeIsbn('0132350882')).toBe('9780132350884');
    expect(normalizeIsbn('080442957X')).toBe('9780804429573');
  });

  it('gives the same result whichever form the same book is written in', () => {
    expect(normalizeIsbn('0-13-235088-2')).toBe(normalizeIsbn('9780132350884'));
  });

  it.each([null, undefined, '', '   ', '123', '9781234567890', 'not-an-isbn'])('returns null for %p', value => {
    expect(normalizeIsbn(value)).toBeNull();
  });
});

describe('normalizeText', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalizeText('  Dom Casmurro! ')).toBe('dom casmurro');
    expect(normalizeText('Ação & Reação')).toBe('acao reacao');
    expect(normalizeText(1899)).toBe('1899');
    expect(normalizeText(null)).toBe('');
  });
});

describe('dedupeKeyFor', () => {
  it('identifies a book with an ISBN by the ISBN-13, whatever the other fields say', () => {
    const a = dedupeKeyFor({ title: 'Clean Code', author: 'Martin', isbn: '0132350882' });
    const b = dedupeKeyFor({ title: 'clean code!', author: 'R. C. Martin', isbn: '978-0-13-235088-4' });

    expect(a).toBe('isbn:9780132350884');
    expect(b).toBe(a);
  });

  it('builds a metadata key for books without a valid ISBN, ignoring case and accents', () => {
    const a = dedupeKeyFor({ title: 'Sagarana', author: 'Guimarães Rosa', publisher: 'Nova Fronteira', publishedYear: 1946, edition: '1ª' });
    const b = dedupeKeyFor({ title: 'SAGARANA', author: 'guimaraes rosa', publisher: 'nova fronteira', publishedYear: 1946, edition: '1a' });

    expect(a.startsWith('meta:')).toBe(true);
    expect(b).toBe(a);
  });

  it('keeps different editions apart', () => {
    const first = dedupeKeyFor({ title: 'X', author: 'Y', edition: '1' });
    const second = dedupeKeyFor({ title: 'X', author: 'Y', edition: '2' });

    expect(first).not.toBe(second);
  });

  it('treats an invalid ISBN as no ISBN', () => {
    expect(dedupeKeyFor({ title: 'X', author: 'Y', isbn: '123' }).startsWith('meta:')).toBe(true);
  });
});
