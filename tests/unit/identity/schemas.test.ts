import { registerSchema, loginSchema } from '../../../src/contexts/identity/auth/authSchemas';
import {
  addMemberSchema,
  createCompanySchema,
  updateCompanySchema,
  verificationSchema,
} from '../../../src/contexts/identity/companies/companiesSchemas';
import { updateRolesSchema } from '../../../src/contexts/identity/me/meSchemas';

const address = {
  street: 'Rua A',
  number: '10',
  district: 'Centro',
  city: 'Recife',
  state: 'pe',
  zip: '50000-000',
};

const company = {
  cnpj: '11.222.333/0001-81',
  legalName: 'Sebo LTDA',
  email: 'CONTATO@Sebo.test ',
  address,
};

describe('registerSchema', () => {
  const base = { name: '  Ana ', email: ' ANA@Test.com ', password: 'secret1' };

  it('trims and lower-cases, and leaves roles undefined when omitted', () => {
    const parsed = registerSchema.parse(base);

    expect(parsed).toEqual({ name: 'Ana', email: 'ana@test.com', password: 'secret1' });
  });

  it('accepts the self-service roles', () => {
    expect(registerSchema.parse({ ...base, roles: ['reader', 'seller'] }).roles).toEqual(['reader', 'seller']);
  });

  it.each([[[]], [['admin']], [['root']], ['reader']])('rejects the roles %p', roles => {
    expect(registerSchema.safeParse({ ...base, roles }).success).toBe(false);
  });

  it.each([
    [{ ...base, password: '123' }, 'at least 6'],
    [{ ...base, email: 'nope' }, 'Invalid email'],
    [{ ...base, name: '  ' }, 'Name is required'],
    [{ email: 'a@b.co', password: 'secret1' }, 'Name is required'],
  ])('rejects invalid input %#', (input, message) => {
    const result = registerSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(i => i.message).join()).toContain(message);
  });
});

describe('loginSchema', () => {
  it('requires both fields and normalizes the email', () => {
    expect(loginSchema.parse({ email: ' A@B.co ', password: 'x' })).toEqual({ email: 'a@b.co', password: 'x' });
    expect(loginSchema.safeParse({ email: 'a@b.co' }).success).toBe(false);
    expect(loginSchema.safeParse({ password: 'x' }).success).toBe(false);
  });
});

describe('updateRolesSchema', () => {
  it('defaults both lists to empty', () => {
    expect(updateRolesSchema.parse({})).toEqual({ add: [], remove: [] });
  });

  it('accepts self-service roles and rejects admin', () => {
    expect(updateRolesSchema.safeParse({ add: ['buyer'], remove: ['reader'] }).success).toBe(true);
    expect(updateRolesSchema.safeParse({ add: ['admin'] }).success).toBe(false);
  });
});

describe('createCompanySchema', () => {
  it('normalizes the CNPJ, email, state, ZIP and phone', () => {
    const parsed = createCompanySchema.parse({ ...company, phone: '(81) 99999-8888' });

    expect(parsed.cnpj).toBe('11222333000181');
    expect(parsed.email).toBe('contato@sebo.test');
    expect(parsed.phone).toBe('81999998888');
    expect(parsed.address.state).toBe('PE');
    expect(parsed.address.zip).toBe('50000000');
  });

  it('treats blank optional fields as absent', () => {
    const parsed = createCompanySchema.parse({ ...company, tradeName: '  ', phone: '' });

    expect(parsed.tradeName).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
  });

  it.each([
    ['an invalid CNPJ', { cnpj: '11.222.333/0001-80' }, 'CNPJ is invalid'],
    ['a missing legal name', { legalName: '' }, 'Legal name is required'],
    ['an invalid email', { email: 'nope' }, 'Invalid email address'],
    ['a short phone', { phone: '1234' }, 'Phone must have 10 or 11 digits'],
    ['an unknown state', { address: { ...address, state: 'ZZ' } }, 'valid Brazilian state'],
    ['a short ZIP', { address: { ...address, zip: '123' } }, 'ZIP code must have 8 digits'],
    ['a missing street', { address: { ...address, street: '' } }, 'Street is required'],
  ])('rejects %s', (_label, override, message) => {
    const result = createCompanySchema.safeParse({ ...company, ...override });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(i => i.message).join()).toContain(message);
  });
});

describe('updateCompanySchema', () => {
  it('makes every field optional and ignores the CNPJ', () => {
    const parsed = updateCompanySchema.parse({ tradeName: 'Novo', cnpj: '44.555.666/0001-81' });

    expect(parsed).toEqual({ tradeName: 'Novo' });
  });
});

describe('addMemberSchema and verificationSchema', () => {
  it('defaults the member role to staff and refuses to add owners', () => {
    expect(addMemberSchema.parse({ email: 'A@B.co' })).toEqual({ email: 'a@b.co', role: 'staff' });
    expect(addMemberSchema.safeParse({ email: 'a@b.co', role: 'owner' }).success).toBe(false);
  });

  it('needs an explicit boolean to verify', () => {
    expect(verificationSchema.parse({ verified: false })).toEqual({ verified: false });
    expect(verificationSchema.safeParse({}).success).toBe(false);
    expect(verificationSchema.safeParse({ verified: 'yes' }).success).toBe(false);
  });
});
