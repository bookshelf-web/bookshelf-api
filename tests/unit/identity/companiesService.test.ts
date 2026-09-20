import {
  CompaniesService,
  toCompanyView,
} from '../../../src/contexts/identity/companies/companiesService';
import { CreateCompanyInput } from '../../../src/contexts/identity/companies/companiesSchemas';
import { Company } from '../../../src/contexts/identity/models/Company';
import { CompanyMember, CompanyRole } from '../../../src/contexts/identity/models/CompanyMember';
import { User } from '../../../src/contexts/identity/models/User';
import { AuditService } from '../../../src/contexts/audit';

const repos = {
  company: { exists: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn() },
  member: {
    exists: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((data: object) => data),
    remove: jest.fn(),
  },
  user: { findOne: jest.fn() },
};
jest.mock('../../../src/contexts/audit', () => ({ AuditService: { record: jest.fn() } }));

const manager = { create: jest.fn((_entity: unknown, data: object) => data), save: jest.fn(async (row: object) => ({ id: 'c1', ...row })) };

jest.mock('../../../src/config/database', () => ({
  AppDataSource: {
    getRepository: (entity: unknown) =>
      entity === Company ? repos.company : entity === CompanyMember ? repos.member : repos.user,
    transaction: (work: (m: typeof manager) => Promise<unknown>) => work(manager),
  },
}));

const company = (overrides: Partial<Company> = {}) =>
  ({
    id: 'c1',
    legalName: 'Sebo LTDA',
    tradeName: null,
    cnpj: '11222333000181',
    email: 'a@b.co',
    phone: null,
    addressStreet: 'Rua A',
    addressNumber: '10',
    addressComplement: null,
    addressDistrict: 'Centro',
    addressCity: 'Recife',
    addressState: 'PE',
    addressZip: '50000000',
    verified: false,
    verifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Company;

const membership = (role: CompanyRole, c = company()) => ({ companyId: c.id, userId: 'u1', role, company: c });

const input: CreateCompanyInput = {
  cnpj: '11222333000181',
  legalName: 'Sebo LTDA',
  email: 'a@b.co',
  address: { street: 'Rua A', number: '10', district: 'Centro', city: 'Recife', state: 'PE', zip: '50000000' },
} as CreateCompanyInput;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('toCompanyView', () => {
  it('nests the address and carries the requester role', () => {
    const view = toCompanyView(company(), CompanyRole.MANAGER);

    expect(view.address).toEqual({
      street: 'Rua A',
      number: '10',
      complement: null,
      district: 'Centro',
      city: 'Recife',
      state: 'PE',
      zip: '50000000',
    });
    expect(view.myRole).toBe(CompanyRole.MANAGER);
    expect(view).not.toHaveProperty('createdBy');
  });
});

describe('create', () => {
  it('saves the company and its owner membership together', async () => {
    repos.company.exists.mockResolvedValue(false);

    const view = await CompaniesService.create('u1', input);

    expect(view.myRole).toBe(CompanyRole.OWNER);
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(manager.create).toHaveBeenNthCalledWith(
      2,
      CompanyMember,
      expect.objectContaining({ userId: 'u1', role: CompanyRole.OWNER }),
    );
  });

  it('rejects a CNPJ that is already registered', async () => {
    repos.company.exists.mockResolvedValue(true);

    await expect(CompaniesService.create('u1', input)).rejects.toMatchObject({
      code: 'CNPJ_ALREADY_REGISTERED',
      statusCode: 409,
    });
    expect(manager.save).not.toHaveBeenCalled();
  });
});

describe('reading', () => {
  it('lists the companies of the user with their role', async () => {
    repos.member.find.mockResolvedValue([membership(CompanyRole.STAFF)]);

    const list = await CompaniesService.listMine('u1');

    expect(list).toHaveLength(1);
    expect(list[0].myRole).toBe(CompanyRole.STAFF);
  });

  it('answers 404 (not 403) for a non-member', async () => {
    repos.member.findOne.mockResolvedValue(null);

    await expect(CompaniesService.getForMember('u1', 'c1')).rejects.toMatchObject({
      code: 'COMPANY_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('lists members with their user data', async () => {
    repos.member.findOne.mockResolvedValue(membership(CompanyRole.STAFF));
    repos.member.find.mockResolvedValue([
      { userId: 'u1', role: CompanyRole.OWNER, user: { name: 'Ana', email: 'ana@test.com' } },
    ]);

    expect(await CompaniesService.listMembers('u1', 'c1')).toEqual([
      { userId: 'u1', name: 'Ana', email: 'ana@test.com', role: CompanyRole.OWNER },
    ]);
  });
});

describe('update', () => {
  beforeEach(() => {
    repos.company.save.mockImplementation(async (c: Company) => c);
  });

  it.each([CompanyRole.OWNER, CompanyRole.MANAGER])('lets a %s change the company', async role => {
    repos.member.findOne.mockResolvedValue(membership(role));

    const view = await CompaniesService.update('u1', 'c1', {
      tradeName: 'Novo',
      phone: undefined,
      address: { ...input.address, complement: undefined, city: 'Olinda' },
    });

    expect(view.tradeName).toBe('Novo');
    expect(view.address.city).toBe('Olinda');
    expect(view.address.complement).toBeNull();
  });

  it('only touches the provided fields', async () => {
    repos.member.findOne.mockResolvedValue(membership(CompanyRole.OWNER));

    const view = await CompaniesService.update('u1', 'c1', { email: 'new@b.co' });

    expect(view.email).toBe('new@b.co');
    expect(view.legalName).toBe('Sebo LTDA');
  });

  it('forbids staff', async () => {
    repos.member.findOne.mockResolvedValue(membership(CompanyRole.STAFF));

    await expect(CompaniesService.update('u1', 'c1', { email: 'x@y.co' })).rejects.toMatchObject({
      code: 'COMPANY_ROLE_REQUIRED',
    });
    expect(repos.company.save).not.toHaveBeenCalled();
  });
});

describe('members', () => {
  it('adds an existing user, only for owners', async () => {
    repos.member.findOne.mockResolvedValue(membership(CompanyRole.OWNER));
    repos.user.findOne.mockResolvedValue({ id: 'u2', name: 'Bia', email: 'bia@test.com' });
    repos.member.exists.mockResolvedValue(false);
    repos.member.save.mockImplementation(async (m: object) => m);

    const added = await CompaniesService.addMember('u1', 'c1', { email: 'bia@test.com', role: CompanyRole.MANAGER });

    expect(added).toEqual({ userId: 'u2', name: 'Bia', email: 'bia@test.com', role: CompanyRole.MANAGER });
  });

  it.each([CompanyRole.MANAGER, CompanyRole.STAFF])('forbids a %s from adding members', async role => {
    repos.member.findOne.mockResolvedValue(membership(role));

    await expect(
      CompaniesService.addMember('u1', 'c1', { email: 'x@y.co', role: CompanyRole.STAFF }),
    ).rejects.toMatchObject({ code: 'COMPANY_OWNER_REQUIRED' });
  });

  it('rejects unknown users and existing members', async () => {
    repos.member.findOne.mockResolvedValue(membership(CompanyRole.OWNER));
    repos.user.findOne.mockResolvedValueOnce(null);
    await expect(
      CompaniesService.addMember('u1', 'c1', { email: 'x@y.co', role: CompanyRole.STAFF }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });

    repos.user.findOne.mockResolvedValueOnce({ id: 'u2' } as User);
    repos.member.exists.mockResolvedValueOnce(true);
    await expect(
      CompaniesService.addMember('u1', 'c1', { email: 'x@y.co', role: CompanyRole.STAFF }),
    ).rejects.toMatchObject({ code: 'MEMBER_ALREADY_EXISTS' });
  });

  it('removes a member but never the owner', async () => {
    repos.member.findOne
      .mockResolvedValueOnce(membership(CompanyRole.OWNER))
      .mockResolvedValueOnce({ userId: 'u2', role: CompanyRole.STAFF });
    await CompaniesService.removeMember('u1', 'c1', 'u2');
    expect(repos.member.remove).toHaveBeenCalled();

    repos.member.findOne
      .mockResolvedValueOnce(membership(CompanyRole.OWNER))
      .mockResolvedValueOnce({ userId: 'u1', role: CompanyRole.OWNER });
    await expect(CompaniesService.removeMember('u1', 'c1', 'u1')).rejects.toMatchObject({
      code: 'OWNER_CANNOT_BE_REMOVED',
    });

    repos.member.findOne.mockResolvedValueOnce(membership(CompanyRole.OWNER)).mockResolvedValueOnce(null);
    await expect(CompaniesService.removeMember('u1', 'c1', 'ghost')).rejects.toMatchObject({
      code: 'MEMBER_NOT_FOUND',
    });
  });
});

describe('admin', () => {
  beforeEach(() => {
    repos.company.save.mockImplementation(async (c: Company) => c);
  });

  it('verifies a company, recording who and when', async () => {
    repos.company.findOne.mockResolvedValue(company());

    const view = await CompaniesService.setVerified('admin-1', 'c1', true);

    expect(view.verified).toBe(true);
    expect(view.verifiedAt).toBeInstanceOf(Date);
    expect(repos.company.save).toHaveBeenCalledWith(expect.objectContaining({ verifiedBy: 'admin-1' }));
    expect(AuditService.record).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'company.verify',
      targetType: 'company',
      targetId: 'c1',
    });
  });

  it('does not audit a verification that changes nothing', async () => {
    repos.company.findOne.mockResolvedValue(company({ verified: true }));

    await CompaniesService.setVerified('admin-1', 'c1', true);

    expect(AuditService.record).not.toHaveBeenCalled();
  });

  it('can revoke a verification', async () => {
    repos.company.findOne.mockResolvedValue(company({ verified: true, verifiedAt: new Date() }));

    const view = await CompaniesService.setVerified('admin-1', 'c1', false);

    expect(view.verified).toBe(false);
    expect(view.verifiedAt).toBeNull();
    expect(AuditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'company.unverify' }));
  });

  it('answers 404 for an unknown company', async () => {
    repos.company.findOne.mockResolvedValue(null);

    await expect(CompaniesService.setVerified('admin-1', 'nope', true)).rejects.toMatchObject({
      code: 'COMPANY_NOT_FOUND',
    });
  });

  it('lists all companies or only the (un)verified ones', async () => {
    repos.company.find.mockResolvedValue([company()]);

    await CompaniesService.listForAdmin();
    await CompaniesService.listForAdmin(false);

    expect(repos.company.find).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: {} }));
    expect(repos.company.find).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { verified: false } }));
  });
});
