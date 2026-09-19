import { formatCnpj, isValidCnpj, normalizeCnpj } from '../../../src/contexts/identity/companies/cnpj';

describe('cnpj', () => {
  it('normalizes to digits only', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizeCnpj(' 11 222 333 0001 81 ')).toBe('11222333000181');
  });

  it.each(['11.222.333/0001-81', '11222333000181', '44.555.666/0001-81', '77888999000181'])(
    'accepts the valid CNPJ %s',
    value => {
      expect(isValidCnpj(value)).toBe(true);
    },
  );

  it.each([
    ['wrong check digit', '11.222.333/0001-82'],
    ['wrong first check digit', '11.222.333/0001-91'],
    ['too short', '1122233300018'],
    ['too long', '112223330001811'],
    ['empty', ''],
    ['letters only', 'abcdefghijklmn'],
    ['a repeated digit', '00.000.000/0000-00'],
    ['another repeated digit', '11111111111111'],
  ])('rejects a CNPJ with %s', (_label, value) => {
    expect(isValidCnpj(value)).toBe(false);
  });

  it('formats 14 digits with punctuation and leaves anything else unformatted', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatCnpj('123')).toBe('123');
  });
});
