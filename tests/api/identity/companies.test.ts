import { ApiClient } from '../../helpers/apiClient';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

const ADMIN_EMAIL = 'admin@bookshelf.test';
const VALID_CNPJ = '11.222.333/0001-81';
const OTHER_CNPJ = '44.555.666/0001-81';

const companyPayload = (overrides: Record<string, unknown> = {}) => ({
  cnpj: VALID_CNPJ,
  legalName: 'Sebo Página Viva LTDA',
  tradeName: 'Sebo Página Viva',
  email: 'contato@paginaviva.test',
  phone: '(11) 91234-5678',
  address: {
    street: 'Rua dos Livros',
    number: '100',
    district: 'Centro',
    city: 'São Paulo',
    state: 'sp',
    zip: '01001-000',
  },
  ...overrides,
});

async function signUp(roles: string[], overrides: Record<string, unknown> = {}) {
  const api = new ApiClient();
  const response = await api.register(TestDataBuilder.createUser({ roles, ...overrides }));
  api.setToken(response.body.token);
  return { api, user: response.body.user };
}

describe('companies', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('POST /api/companies', () => {
    it('registers a company and makes the caller its owner', async () => {
      const { api } = await signUp(['seller']);

      const response = await api.call('post', '/companies', companyPayload());

      expect(response.status).toBe(201);
      expect(response.body.company).toMatchObject({
        legalName: 'Sebo Página Viva LTDA',
        cnpj: '11222333000181',
        phone: '11912345678',
        verified: false,
        myRole: 'owner',
        address: { state: 'SP', zip: '01001000' },
      });
    });

    it('requires the seller role', async () => {
      const { api } = await signUp(['reader']);

      const response = await api.call('post', '/companies', companyPayload());

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ROLE_REQUIRED');
      expect(response.body.context).toBe('identity');
    });

    it('requires authentication', async () => {
      const response = await new ApiClient().call('post', '/companies', companyPayload());

      expect(response.status).toBe(401);
    });

    it('rejects an invalid CNPJ', async () => {
      const { api } = await signUp(['seller']);

      const response = await api.call('post', '/companies', companyPayload({ cnpj: '11.222.333/0001-82' }));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('CNPJ is invalid');
    });

    it('rejects an invalid state and ZIP code', async () => {
      const { api } = await signUp(['seller']);
      const address = { ...companyPayload().address, state: 'XX', zip: '123' };

      const response = await api.call('post', '/companies', companyPayload({ address }));

      expect(response.status).toBe(400);
    });

    it('rejects a CNPJ that is already registered', async () => {
      const first = await signUp(['seller']);
      const second = await signUp(['seller']);
      await first.api.call('post', '/companies', companyPayload());

      const response = await second.api.call('post', '/companies', companyPayload());

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('CNPJ_ALREADY_REGISTERED');
    });
  });

  describe('reading and updating', () => {
    it('lists only the companies the user belongs to', async () => {
      const owner = await signUp(['seller']);
      const stranger = await signUp(['seller']);
      await owner.api.call('post', '/companies', companyPayload());

      const mine = await owner.api.call('get', '/companies');
      const theirs = await stranger.api.call('get', '/companies');

      expect(mine.body.companies).toHaveLength(1);
      expect(theirs.body.companies).toHaveLength(0);
    });

    it('shows a member their company and hides it from everyone else', async () => {
      const owner = await signUp(['seller']);
      const stranger = await signUp(['seller']);
      const created = await owner.api.call('post', '/companies', companyPayload());
      const id = created.body.company.id;

      expect((await owner.api.call('get', `/companies/${id}`)).status).toBe(200);
      const hidden = await stranger.api.call('get', `/companies/${id}`);
      expect(hidden.status).toBe(404);
      expect(hidden.body.code).toBe('COMPANY_NOT_FOUND');
    });

    it('lets the owner update the company but not its CNPJ', async () => {
      const owner = await signUp(['seller']);
      const created = await owner.api.call('post', '/companies', companyPayload());
      const id = created.body.company.id;

      const response = await owner.api.call('put', `/companies/${id}`, {
        tradeName: 'Novo Nome',
        cnpj: OTHER_CNPJ,
      });

      expect(response.status).toBe(200);
      expect(response.body.company.tradeName).toBe('Novo Nome');
      expect(response.body.company.cnpj).toBe('11222333000181');
    });

    it('rejects a malformed company id', async () => {
      const { api } = await signUp(['seller']);

      expect((await api.call('get', '/companies/not-a-uuid')).status).toBe(400);
    });
  });

  describe('members', () => {
    async function ownerWithCompany() {
      const owner = await signUp(['seller']);
      const created = await owner.api.call('post', '/companies', companyPayload());
      return { ...owner, companyId: created.body.company.id as string };
    }

    it('lets the owner add a member by email, who can then read but not manage', async () => {
      const { api, companyId } = await ownerWithCompany();
      const staff = await signUp(['reader']);

      const added = await api.call('post', `/companies/${companyId}/members`, {
        email: staff.user.email,
        role: 'staff',
      });
      expect(added.status).toBe(201);

      expect((await staff.api.call('get', `/companies/${companyId}`)).status).toBe(200);
      const update = await staff.api.call('put', `/companies/${companyId}`, { tradeName: 'X' });
      expect(update.status).toBe(403);
      expect(update.body.code).toBe('COMPANY_ROLE_REQUIRED');
      const invite = await staff.api.call('post', `/companies/${companyId}/members`, {
        email: 'someone@example.com',
      });
      expect(invite.status).toBe(403);
    });

    it('lets a manager update the company', async () => {
      const { api, companyId } = await ownerWithCompany();
      const manager = await signUp(['reader']);
      await api.call('post', `/companies/${companyId}/members`, {
        email: manager.user.email,
        role: 'manager',
      });

      const response = await manager.api.call('put', `/companies/${companyId}`, { tradeName: 'Gerente' });

      expect(response.status).toBe(200);
    });

    it('rejects unknown users and duplicates', async () => {
      const { api, companyId } = await ownerWithCompany();
      const member = await signUp(['reader']);

      const unknown = await api.call('post', `/companies/${companyId}/members`, {
        email: 'nobody@example.com',
      });
      expect(unknown.status).toBe(404);
      expect(unknown.body.code).toBe('USER_NOT_FOUND');

      await api.call('post', `/companies/${companyId}/members`, { email: member.user.email });
      const duplicate = await api.call('post', `/companies/${companyId}/members`, {
        email: member.user.email,
      });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.code).toBe('MEMBER_ALREADY_EXISTS');
    });

    it('lists members, removes one, and protects the owner', async () => {
      const { api, user, companyId } = await ownerWithCompany();
      const member = await signUp(['reader']);
      await api.call('post', `/companies/${companyId}/members`, { email: member.user.email });

      const listed = await api.call('get', `/companies/${companyId}/members`);
      expect(listed.body.members).toHaveLength(2);

      const removed = await api.call('delete', `/companies/${companyId}/members/${member.user.id}`);
      expect(removed.status).toBe(200);
      expect((await member.api.call('get', `/companies/${companyId}`)).status).toBe(404);

      const ownerRemoval = await api.call('delete', `/companies/${companyId}/members/${user.id}`);
      expect(ownerRemoval.status).toBe(403);
      expect(ownerRemoval.body.code).toBe('OWNER_CANNOT_BE_REMOVED');
    });
  });

  describe('admin verification', () => {
    it('lets an admin list and verify companies', async () => {
      const owner = await signUp(['seller']);
      const created = await owner.api.call('post', '/companies', companyPayload());
      const id = created.body.company.id;
      const admin = await signUp(['reader'], { email: ADMIN_EMAIL });

      const pending = await admin.api.call('get', '/admin/companies?verified=false');
      expect(pending.body.companies.map((c: { id: string }) => c.id)).toContain(id);

      const verified = await admin.api.call('patch', `/admin/companies/${id}/verification`, {
        verified: true,
      });
      expect(verified.status).toBe(200);
      expect(verified.body.company.verified).toBe(true);
      expect(verified.body.company.verifiedAt).toBeTruthy();

      const mine = await owner.api.call('get', `/companies/${id}`);
      expect(mine.body.company.verified).toBe(true);
    });

    it('is forbidden for everyone else', async () => {
      const owner = await signUp(['seller']);
      const created = await owner.api.call('post', '/companies', companyPayload());

      const list = await owner.api.call('get', '/admin/companies');
      const verify = await owner.api.call('patch', `/admin/companies/${created.body.company.id}/verification`, {
        verified: true,
      });

      expect(list.status).toBe(403);
      expect(verify.status).toBe(403);
    });

    it('returns 404 for an unknown company', async () => {
      const admin = await signUp(['reader'], { email: ADMIN_EMAIL });

      const response = await admin.api.call(
        'patch',
        '/admin/companies/00000000-0000-4000-8000-000000000000/verification',
        { verified: true },
      );

      expect(response.status).toBe(404);
    });
  });
});
