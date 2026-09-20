import { AuditService, diffFields } from '../../../src/contexts/audit/auditService';

const repository = {
  create: jest.fn((data: object) => data),
  save: jest.fn(async (row: object) => ({ id: 'a1', ...row })),
  findAndCount: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  AppDataSource: { getRepository: () => repository },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuditService.record', () => {
  it('stores who did what to which target', async () => {
    const saved = await AuditService.record({
      actorId: 'admin-1',
      action: 'user.update',
      targetType: 'user',
      targetId: 'u1',
      changes: { name: { from: 'A', to: 'B' } },
    });

    expect(saved).toMatchObject({ actorId: 'admin-1', action: 'user.update', changes: { name: { from: 'A', to: 'B' } } });
  });

  it('stores null when there are no changes to describe', async () => {
    await AuditService.record({ actorId: 'a', action: 'company.verify', targetType: 'company', targetId: 'c1' });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ changes: null }));
  });
});

describe('AuditService.list', () => {
  beforeEach(() => {
    repository.findAndCount.mockResolvedValue([[{ id: 'a1' }], 41]);
  });

  it('returns the newest entries first with pagination', async () => {
    const result = await AuditService.list({ page: 2, limit: 20 });

    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: {},
      order: { createdAt: 'DESC' },
      skip: 20,
      take: 20,
    });
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 41, totalPages: 3 });
  });

  it('filters by target and actor', async () => {
    await AuditService.list({ page: 1, limit: 10, targetType: 'user', targetId: 'u1', actorId: 'admin-1' });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { targetType: 'user', targetId: 'u1', actorId: 'admin-1' } }),
    );
  });
});

describe('diffFields', () => {
  it('keeps only the fields that changed, comparing arrays by value', () => {
    const changes = diffFields(
      { name: 'Ana', roles: ['reader'], status: 'active' },
      { name: 'Ana', roles: ['reader', 'buyer'], status: 'active' },
    );

    expect(changes).toEqual({ roles: { from: ['reader'], to: ['reader', 'buyer'] } });
  });

  it('is empty when nothing changed', () => {
    expect(diffFields({ a: 1, b: [1] }, { a: 1, b: [1] })).toEqual({});
  });
});
