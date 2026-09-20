import { ApiClient } from '../../helpers/apiClient';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

const ADMIN_EMAIL = 'admin@bookshelf.test';

async function signUp(overrides: Record<string, unknown> = {}) {
  const api = new ApiClient();
  const data = TestDataBuilder.createUser(overrides);
  const response = await api.register(data);
  api.setToken(response.body.token);
  return { api, user: response.body.user, password: data.password as string, email: data.email as string };
}

describe('admin: users', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('access', () => {
    it('is forbidden for non-admins and requires a token', async () => {
      const { api } = await signUp();

      expect((await api.call('get', '/admin/users')).status).toBe(403);
      expect((await api.call('patch', '/admin/users/00000000-0000-4000-8000-000000000000', { name: 'x' })).status).toBe(403);
      expect((await new ApiClient().call('get', '/admin/users')).status).toBe(401);
    });
  });

  describe('GET /api/admin/users', () => {
    it('lists accounts without ever exposing the password', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      await signUp({ name: 'Bia Souza' });

      const response = await admin.api.call('get', '/admin/users');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2);
      expect(JSON.stringify(response.body)).not.toContain('password');
      expect(response.body.pagination).toMatchObject({ page: 1, total: 2, totalPages: 1 });
    });

    it('searches by name or email, and filters by role and status', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const seller = await signUp({ name: 'Carla Vendedora', roles: ['seller'] });
      await signUp({ name: 'Diego Leitor' });
      await admin.api.call('patch', `/admin/users/${seller.user.id}`, { status: 'suspended' });

      const byName = await admin.api.call('get', '/admin/users?search=carla');
      const byRole = await admin.api.call('get', '/admin/users?role=seller');
      const byStatus = await admin.api.call('get', '/admin/users?status=suspended');

      expect(byName.body.users.map((u: { name: string }) => u.name)).toEqual(['Carla Vendedora']);
      expect(byRole.body.users).toHaveLength(1);
      expect(byStatus.body.users[0].id).toBe(seller.user.id);
    });

    it('paginates', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      await signUp();
      await signUp();

      const response = await admin.api.call('get', '/admin/users?limit=2&page=2');

      expect(response.body.users).toHaveLength(1);
      expect(response.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    });

    it('rejects an invalid filter', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });

      expect((await admin.api.call('get', '/admin/users?role=root')).status).toBe(400);
    });
  });

  describe('PATCH /api/admin/users/:id', () => {
    it('edits name, email and roles, and audits the change', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const target = await signUp();

      const response = await admin.api.call('patch', `/admin/users/${target.user.id}`, {
        name: 'Novo Nome',
        email: 'Novo@Email.com',
        roles: ['reader', 'seller'],
      });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({ name: 'Novo Nome', email: 'novo@email.com' });
      expect(response.body.user.roles.sort()).toEqual(['buyer', 'reader', 'seller']);

      const audit = await admin.api.call('get', `/admin/audit-logs?targetType=user&targetId=${target.user.id}`);
      expect(audit.status).toBe(200);
      expect(audit.body.entries).toHaveLength(1);
      expect(audit.body.entries[0]).toMatchObject({
        action: 'user.update',
        actorId: admin.user.id,
        changes: { name: { from: target.user.name, to: 'Novo Nome' } },
      });
    });

    it('can grant the admin role', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const target = await signUp();

      const response = await admin.api.call('patch', `/admin/users/${target.user.id}`, {
        roles: ['reader', 'admin'],
      });

      expect(response.body.user.roles).toContain('admin');
    });

    it('suspends an account, which then cannot sign in, and can reactivate it', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const target = await signUp();

      await admin.api.call('patch', `/admin/users/${target.user.id}`, { status: 'suspended' });
      const blocked = await new ApiClient().login({ email: target.email, password: target.password });
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('ACCOUNT_SUSPENDED');

      await admin.api.call('patch', `/admin/users/${target.user.id}`, { status: 'active' });
      const allowed = await new ApiClient().login({ email: target.email, password: target.password });
      expect(allowed.status).toBe(200);
    });

    it('does not reveal a suspension to someone with the wrong password', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const target = await signUp();
      await admin.api.call('patch', `/admin/users/${target.user.id}`, { status: 'suspended' });

      const response = await new ApiClient().login({ email: target.email, password: 'wrong-password' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('refuses to suspend yourself', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });

      const response = await admin.api.call('patch', `/admin/users/${admin.user.id}`, { status: 'suspended' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('CANNOT_SUSPEND_SELF');
    });

    it('protects the last active admin, and lets an admin go once another exists', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const other = await signUp();
      const stripped = await admin.api.call('patch', `/admin/users/${admin.user.id}`, { roles: ['reader'] });
      expect(stripped.status).toBe(403);
      expect(stripped.body.code).toBe('LAST_ADMIN');

      await admin.api.call('patch', `/admin/users/${other.user.id}`, { roles: ['reader', 'admin'] });
      const allowed = await admin.api.call('patch', `/admin/users/${admin.user.id}`, { roles: ['reader'] });
      expect(allowed.status).toBe(200);
    });

    it('rejects an email that is taken, unknown fields, empty roles and empty bodies', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const target = await signUp();
      const id = target.user.id;

      const taken = await admin.api.call('patch', `/admin/users/${id}`, { email: ADMIN_EMAIL });
      expect(taken.status).toBe(409);
      expect((await admin.api.call('patch', `/admin/users/${id}`, { password: 'hack' })).status).toBe(400);
      expect((await admin.api.call('patch', `/admin/users/${id}`, { roles: [] })).status).toBe(400);
      expect((await admin.api.call('patch', `/admin/users/${id}`, {})).status).toBe(400);
    });

    it('answers 404 for an unknown user and 400 for a malformed id', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });

      const unknown = await admin.api.call('patch', '/admin/users/00000000-0000-4000-8000-000000000000', { name: 'X' });
      expect(unknown.status).toBe(404);
      expect((await admin.api.call('get', '/admin/users/not-a-uuid')).status).toBe(400);
    });
  });

  describe('audit trail', () => {
    it('is admin only and records company verification too', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const seller = await signUp({ roles: ['seller'] });
      const created = await seller.api.call('post', '/companies', {
        cnpj: '11.222.333/0001-81',
        legalName: 'Sebo LTDA',
        email: 'a@b.co',
        address: { street: 'R', number: '1', district: 'C', city: 'X', state: 'SP', zip: '01001-000' },
      });
      await admin.api.call('patch', `/admin/companies/${created.body.company.id}/verification`, { verified: true });

      expect((await seller.api.call('get', '/admin/audit-logs')).status).toBe(403);
      const log = await admin.api.call('get', '/admin/audit-logs?targetType=company');
      expect(log.body.entries[0]).toMatchObject({ action: 'company.verify', actorId: admin.user.id });
    });
  });

  describe('own profile', () => {
    it('changes the display name and returns a fresh session', async () => {
      const { api } = await signUp();

      const response = await api.call('patch', '/me/profile', { name: 'Ana Souza' });

      expect(response.status).toBe(200);
      expect(response.body.user.name).toBe('Ana Souza');
      expect(response.body.token).toBeTruthy();
      expect((await api.call('patch', '/me/profile', { name: '  ' })).status).toBe(400);
    });

    it('changes the password only with the current one', async () => {
      const { api, email, password } = await signUp();

      const wrong = await api.call('patch', '/me/password', { currentPassword: 'nope', newPassword: 'brand-new-1' });
      expect(wrong.status).toBe(401);
      expect(wrong.body.code).toBe('INVALID_CURRENT_PASSWORD');

      const same = await api.call('patch', '/me/password', { currentPassword: password, newPassword: password });
      expect(same.status).toBe(400);

      const ok = await api.call('patch', '/me/password', { currentPassword: password, newPassword: 'brand-new-1' });
      expect(ok.status).toBe(200);

      expect((await new ApiClient().login({ email, password })).status).toBe(401);
      expect((await new ApiClient().login({ email, password: 'brand-new-1' })).status).toBe(200);
    });

    it('rejects a short new password', async () => {
      const { api, password } = await signUp();

      const response = await api.call('patch', '/me/password', { currentPassword: password, newPassword: '123' });

      expect(response.status).toBe(400);
    });
  });
});
