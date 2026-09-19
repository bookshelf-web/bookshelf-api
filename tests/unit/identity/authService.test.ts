import bcrypt from 'bcryptjs';
import { AuthService, withAdminIfAllowlisted } from '../../../src/contexts/identity/auth/authService';
import { verifyAuthToken } from '../../../src/shared/jwt';
import { Role } from '../../../src/shared/roles';

const repository = {
  findOne: jest.fn(),
  create: jest.fn((data: object) => ({ id: 'u1', createdAt: new Date(), updatedAt: new Date(), ...data })),
  save: jest.fn(async (user: object) => user),
  update: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  AppDataSource: { getRepository: () => repository },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuthService.register', () => {
  it('creates a library-only account by default, hashing the password', async () => {
    repository.findOne.mockResolvedValue(null);

    const { token, user } = await AuthService.register({
      name: 'Ana',
      email: 'ana@test.com',
      password: 'secret1',
    });

    expect(user.roles).toEqual([Role.READER]);
    expect(user).not.toHaveProperty('password');
    const saved = repository.save.mock.calls[0][0] as { password: string };
    expect(saved.password).not.toBe('secret1');
    await expect(bcrypt.compare('secret1', saved.password)).resolves.toBe(true);
    expect(verifyAuthToken(token)).toEqual({ userId: 'u1', roles: [Role.READER] });
  });

  it('stores the requested roles and makes sellers buyers too', async () => {
    repository.findOne.mockResolvedValue(null);

    const { user } = await AuthService.register({
      name: 'Bia',
      email: 'bia@test.com',
      password: 'secret1',
      roles: [Role.SELLER],
    });

    expect([...user.roles].sort()).toEqual([Role.BUYER, Role.SELLER].sort());
  });

  it('grants admin to an allow-listed email', async () => {
    repository.findOne.mockResolvedValue(null);

    const { user } = await AuthService.register({
      name: 'Root',
      email: 'ADMIN@bookshelf.test',
      password: 'secret1',
    });

    expect(user.roles).toContain(Role.ADMIN);
  });

  it('rejects an email that is already registered', async () => {
    repository.findOne.mockResolvedValue({ id: 'existing' });

    await expect(
      AuthService.register({ name: 'A', email: 'a@test.com', password: 'secret1' }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED', statusCode: 409 });
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  const stored = async (overrides: object = {}) => ({
    id: 'u1',
    name: 'Ana',
    email: 'ana@test.com',
    password: await bcrypt.hash('secret1', 4),
    roles: [Role.READER, Role.BUYER],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it('returns a token carrying the stored roles', async () => {
    repository.findOne.mockResolvedValue(await stored());

    const { token, user } = await AuthService.login({ email: 'ana@test.com', password: 'secret1' });

    expect(user.roles).toEqual([Role.READER, Role.BUYER]);
    expect(verifyAuthToken(token).roles).toEqual([Role.READER, Role.BUYER]);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown email', null, 'secret1'],
    ['a wrong password', 'stored', 'wrong-password'],
  ])('answers %s with the same generic error', async (_label, found, password) => {
    repository.findOne.mockResolvedValue(found === 'stored' ? await stored() : null);

    await expect(AuthService.login({ email: 'ana@test.com', password })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  });

  it('promotes an existing account whose email was added to ADMIN_EMAILS', async () => {
    repository.findOne.mockResolvedValue(await stored({ email: 'admin@bookshelf.test' }));

    const { user } = await AuthService.login({ email: 'admin@bookshelf.test', password: 'secret1' });

    expect(user.roles).toContain(Role.ADMIN);
    expect(repository.update).toHaveBeenCalledWith('u1', {
      roles: [Role.READER, Role.BUYER, Role.ADMIN],
    });
  });
});

describe('withAdminIfAllowlisted', () => {
  it('adds admin once, case-insensitively, and only for allow-listed emails', () => {
    expect(withAdminIfAllowlisted('Admin@Bookshelf.test', [Role.READER])).toEqual([Role.READER, Role.ADMIN]);
    expect(withAdminIfAllowlisted('admin@bookshelf.test', [Role.ADMIN])).toEqual([Role.ADMIN]);
    expect(withAdminIfAllowlisted('someone@else.com', [Role.READER])).toEqual([Role.READER]);
  });
});
