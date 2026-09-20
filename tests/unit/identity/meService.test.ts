import bcrypt from 'bcryptjs';
import { MeService } from '../../../src/contexts/identity/me/meService';
import { verifyAuthToken } from '../../../src/shared/jwt';
import { Role } from '../../../src/shared/roles';

const users = { findOne: jest.fn(), update: jest.fn() };
const listMine = jest.fn();

jest.mock('../../../src/config/database', () => ({
  AppDataSource: { getRepository: () => users },
}));
jest.mock('../../../src/contexts/identity/companies/companiesService', () => ({
  CompaniesService: { listMine: (...args: unknown[]) => listMine(...args) },
}));

const account = (roles: Role[], email = 'ana@test.com') => ({
  id: 'u1',
  name: 'Ana',
  email,
  roles,
  createdAt: new Date(),
  updatedAt: new Date(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MeService.getProfile', () => {
  it('returns the public user and their companies', async () => {
    users.findOne.mockResolvedValue({ ...account([Role.READER]), password: 'hash' });
    listMine.mockResolvedValue([{ id: 'c1' }]);

    const profile = await MeService.getProfile('u1');

    expect(profile.user.roles).toEqual([Role.READER]);
    expect(profile.user).not.toHaveProperty('password');
    expect(profile.companies).toEqual([{ id: 'c1' }]);
  });

  it('fails when the user no longer exists', async () => {
    users.findOne.mockResolvedValue(null);

    await expect(MeService.getProfile('gone')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});

describe('MeService.updateRoles', () => {
  it('adds and removes roles, persists them and returns a matching token', async () => {
    users.findOne.mockResolvedValue(account([Role.READER]));

    const result = await MeService.updateRoles('u1', { add: [Role.BUYER], remove: [Role.READER] });

    expect(result.user.roles).toEqual([Role.BUYER]);
    expect(users.update).toHaveBeenCalledWith('u1', { roles: [Role.BUYER] });
    expect(verifyAuthToken(result.token).roles).toEqual([Role.BUYER]);
  });

  it('keeps the buyer role while the account is a seller', async () => {
    users.findOne.mockResolvedValue(account([Role.SELLER, Role.BUYER]));

    const { user } = await MeService.updateRoles('u1', { add: [], remove: [Role.BUYER] });

    expect([...user.roles].sort()).toEqual([Role.BUYER, Role.SELLER].sort());
  });

  it('never removes an allow-listed admin', async () => {
    users.findOne.mockResolvedValue(account([Role.READER, Role.ADMIN], 'admin@bookshelf.test'));

    const { user } = await MeService.updateRoles('u1', { add: [Role.BUYER], remove: [Role.READER] });

    expect(user.roles).toContain(Role.ADMIN);
  });

  it('refuses to leave the account without a role', async () => {
    users.findOne.mockResolvedValue(account([Role.READER]));

    await expect(MeService.updateRoles('u1', { add: [], remove: [Role.READER] })).rejects.toMatchObject({
      code: 'ROLE_REQUIRED_MINIMUM',
    });
    expect(users.update).not.toHaveBeenCalled();
  });

  it('refuses an empty change', async () => {
    await expect(MeService.updateRoles('u1', { add: [], remove: [] })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(users.findOne).not.toHaveBeenCalled();
  });
});

describe('MeService.updateProfile', () => {
  it('changes the name and returns a fresh session', async () => {
    users.findOne.mockResolvedValue(account([Role.READER]));

    const result = await MeService.updateProfile('u1', { name: 'Ana Souza' });

    expect(users.update).toHaveBeenCalledWith('u1', { name: 'Ana Souza' });
    expect(result.user.name).toBe('Ana Souza');
    expect(verifyAuthToken(result.token).userId).toBe('u1');
  });
});

describe('MeService.changePassword', () => {
  const stored = async () => ({ id: 'u1', password: await bcrypt.hash('old-secret', 4) });

  it('stores a hash of the new password', async () => {
    users.findOne.mockResolvedValue(await stored());

    await MeService.changePassword('u1', { currentPassword: 'old-secret', newPassword: 'new-secret' });

    const [, change] = users.update.mock.calls[0];
    expect(change.password).not.toBe('new-secret');
    await expect(bcrypt.compare('new-secret', change.password)).resolves.toBe(true);
  });

  it('refuses a wrong current password', async () => {
    users.findOne.mockResolvedValue(await stored());

    await expect(
      MeService.changePassword('u1', { currentPassword: 'guess', newPassword: 'new-secret' }),
    ).rejects.toMatchObject({ code: 'INVALID_CURRENT_PASSWORD', statusCode: 401 });
    expect(users.update).not.toHaveBeenCalled();
  });

  it('refuses reusing the same password', async () => {
    users.findOne.mockResolvedValue(await stored());

    await expect(
      MeService.changePassword('u1', { currentPassword: 'old-secret', newPassword: 'old-secret' }),
    ).rejects.toMatchObject({ code: 'PASSWORD_UNCHANGED' });
  });

  it('fails for an unknown user', async () => {
    users.findOne.mockResolvedValue(null);

    await expect(
      MeService.changePassword('gone', { currentPassword: 'a', newPassword: 'bbbbbb' }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});
