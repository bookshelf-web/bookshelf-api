import { UsersService, toAdminUserView } from '../../../src/contexts/identity/users/usersService';
import {
  adminUpdateUserSchema,
  listUsersQuerySchema,
} from '../../../src/contexts/identity/users/usersSchemas';
import { User, UserStatus } from '../../../src/contexts/identity/models/User';
import { AuditService } from '../../../src/contexts/audit';
import { Role } from '../../../src/shared/roles';

const qb = {
  andWhere: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
  getCount: jest.fn(),
};
const repository = {
  createQueryBuilder: jest.fn(() => qb),
  findOne: jest.fn(),
  save: jest.fn(async (user: User) => user),
};

jest.mock('../../../src/config/database', () => ({
  AppDataSource: { getRepository: () => repository },
}));
jest.mock('../../../src/contexts/audit', () => ({
  ...jest.requireActual('../../../src/contexts/audit/auditService'),
  AuditService: { record: jest.fn() },
}));

const account = (overrides: Partial<User> = {}) =>
  ({
    id: 'u1',
    name: 'Ana',
    email: 'ana@test.com',
    roles: [Role.READER],
    status: UserStatus.ACTIVE,
    password: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

beforeEach(() => {
  jest.clearAllMocks();
  repository.save.mockImplementation(async (user: User) => user);
});

describe('toAdminUserView', () => {
  it('never exposes the password hash', () => {
    const view = toAdminUserView(account());

    expect(view).not.toHaveProperty('password');
    expect(view).toMatchObject({ id: 'u1', status: 'active', roles: ['reader'] });
  });
});

describe('UsersService.list', () => {
  beforeEach(() => {
    qb.getManyAndCount.mockResolvedValue([[account()], 45]);
  });

  it('paginates newest first', async () => {
    const result = await UsersService.list({ page: 3, limit: 20 });

    expect(qb.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
    expect(qb.skip).toHaveBeenCalledWith(40);
    expect(qb.take).toHaveBeenCalledWith(20);
    expect(result.pagination).toEqual({ page: 3, limit: 20, total: 45, totalPages: 3 });
    expect(result.users[0]).not.toHaveProperty('password');
  });

  it('adds one condition per filter', async () => {
    await UsersService.list({ page: 1, limit: 20, search: 'ana', role: Role.SELLER, status: UserStatus.SUSPENDED });

    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('LOWER(user.name)'), { search: '%ana%' });
    expect(qb.andWhere).toHaveBeenCalledWith(':role = ANY(user.roles)', { role: Role.SELLER });
    expect(qb.andWhere).toHaveBeenCalledWith('user.status = :status', { status: UserStatus.SUSPENDED });
  });

  it('adds no conditions without filters', async () => {
    await UsersService.list({ page: 1, limit: 20 });

    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});

describe('UsersService.getById', () => {
  it('answers 404 for an unknown user', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(UsersService.getById('nope')).rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
  });
});

describe('UsersService.update', () => {
  it('changes the fields, and audits exactly what changed', async () => {
    repository.findOne.mockResolvedValue(account());

    const view = await UsersService.update('admin-1', 'u1', {
      name: 'Ana Souza',
      roles: [Role.READER, Role.SELLER],
    });

    expect(view.name).toBe('Ana Souza');
    expect([...view.roles].sort()).toEqual([Role.BUYER, Role.READER, Role.SELLER].sort());
    expect(AuditService.record).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'user.update',
      targetType: 'user',
      targetId: 'u1',
      changes: {
        name: { from: 'Ana', to: 'Ana Souza' },
        roles: { from: [Role.READER], to: expect.arrayContaining([Role.READER, Role.SELLER, Role.BUYER]) },
      },
    });
  });

  it('does not audit an update that changes nothing', async () => {
    repository.findOne.mockResolvedValue(account());

    await UsersService.update('admin-1', 'u1', { name: 'Ana' });

    expect(AuditService.record).not.toHaveBeenCalled();
  });

  it('rejects an empty change', async () => {
    await expect(UsersService.update('admin-1', 'u1', {})).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown user', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(UsersService.update('admin-1', 'nope', { name: 'X' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  it('never lets an admin suspend their own account', async () => {
    repository.findOne.mockResolvedValue(account({ id: 'admin-1', roles: [Role.ADMIN] }));

    await expect(
      UsersService.update('admin-1', 'admin-1', { status: UserStatus.SUSPENDED }),
    ).rejects.toMatchObject({ code: 'CANNOT_SUSPEND_SELF', statusCode: 403 });
  });

  describe('protecting the last admin', () => {
    const admin = () => account({ id: 'u2', roles: [Role.ADMIN, Role.READER] });

    it('refuses to remove the admin role from the only active admin', async () => {
      repository.findOne.mockResolvedValue(admin());
      qb.getCount.mockResolvedValue(1);

      await expect(UsersService.update('other', 'u2', { roles: [Role.READER] })).rejects.toMatchObject({
        code: 'LAST_ADMIN',
      });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('refuses to suspend the only active admin', async () => {
      repository.findOne.mockResolvedValue(admin());
      qb.getCount.mockResolvedValue(1);

      await expect(
        UsersService.update('other', 'u2', { status: UserStatus.SUSPENDED }),
      ).rejects.toMatchObject({ code: 'LAST_ADMIN' });
    });

    it('allows it when another active admin remains', async () => {
      repository.findOne.mockResolvedValue(admin());
      qb.getCount.mockResolvedValue(2);

      const view = await UsersService.update('other', 'u2', { roles: [Role.READER] });

      expect(view.roles).not.toContain(Role.ADMIN);
    });

    it('does not count a change that keeps the admin active', async () => {
      repository.findOne.mockResolvedValue(admin());

      await UsersService.update('other', 'u2', { name: 'Renamed' });

      expect(qb.getCount).not.toHaveBeenCalled();
    });
  });

  it('refuses an email that belongs to someone else, but not the same email again', async () => {
    repository.findOne
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce({ id: 'someone-else' });
    await expect(UsersService.update('admin-1', 'u1', { email: 'taken@test.com' })).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_REGISTERED',
      statusCode: 409,
    });

    repository.findOne.mockResolvedValueOnce(account()).mockResolvedValueOnce({ id: 'u1' });
    const view = await UsersService.update('admin-1', 'u1', { email: 'ana@new.com' });
    expect(view.email).toBe('ana@new.com');
  });

  it('can reactivate a suspended account', async () => {
    repository.findOne.mockResolvedValue(account({ status: UserStatus.SUSPENDED }));

    const view = await UsersService.update('admin-1', 'u1', { status: UserStatus.ACTIVE });

    expect(view.status).toBe(UserStatus.ACTIVE);
  });
});

describe('user admin schemas', () => {
  it('lists with defaults and validates filters', () => {
    expect(listUsersQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(listUsersQuerySchema.safeParse({ role: 'root' }).success).toBe(false);
    expect(listUsersQuerySchema.safeParse({ status: 'gone' }).success).toBe(false);
    expect(listUsersQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('lets an admin set any role, but nothing unknown', () => {
    expect(adminUpdateUserSchema.parse({ roles: ['admin', 'seller'] })).toEqual({ roles: ['admin', 'seller'] });
    expect(adminUpdateUserSchema.safeParse({ roles: [] }).success).toBe(false);
    expect(adminUpdateUserSchema.safeParse({ roles: ['root'] }).success).toBe(false);
    expect(adminUpdateUserSchema.safeParse({ password: 'x' }).success).toBe(false);
  });

  it('normalises the email and rejects blank names', () => {
    expect(adminUpdateUserSchema.parse({ email: ' A@B.co ' })).toEqual({ email: 'a@b.co' });
    expect(adminUpdateUserSchema.safeParse({ name: '  ' }).success).toBe(false);
  });
});
