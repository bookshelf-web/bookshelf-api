import { ApiClient } from '../../helpers/apiClient';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

const ADMIN_EMAIL = 'admin@bookshelf.test';

describe('account roles', () => {
  let api: ApiClient;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    api = new ApiClient();
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('registration', () => {
    it('defaults to the reader role (library only)', async () => {
      const response = await api.register(TestDataBuilder.createUser());

      expect(response.status).toBe(201);
      expect(response.body.user.roles).toEqual(['reader']);
    });

    it('stores the chosen roles', async () => {
      const response = await api.register(TestDataBuilder.createUser({ roles: ['reader', 'buyer'] }));

      expect(response.status).toBe(201);
      expect(response.body.user.roles.sort()).toEqual(['buyer', 'reader']);
    });

    it('makes a seller a buyer too', async () => {
      const response = await api.register(TestDataBuilder.createUser({ roles: ['seller'] }));

      expect(response.body.user.roles.sort()).toEqual(['buyer', 'seller']);
    });

    it('rejects an empty role list and unknown roles', async () => {
      const empty = await api.register(TestDataBuilder.createUser({ roles: [] }));
      const unknown = await api.register(TestDataBuilder.createUser({ roles: ['superuser'] }));

      expect(empty.status).toBe(400);
      expect(unknown.status).toBe(400);
    });

    it('never lets a user pick the admin role', async () => {
      const response = await api.register(TestDataBuilder.createUser({ roles: ['admin'] }));

      expect(response.status).toBe(400);
    });

    it('grants admin only to allow-listed emails', async () => {
      const admin = await api.register(TestDataBuilder.createUser({ email: ADMIN_EMAIL }));
      const regular = await api.register(TestDataBuilder.createUser());

      expect(admin.body.user.roles).toContain('admin');
      expect(regular.body.user.roles).not.toContain('admin');
    });
  });

  describe('library access', () => {
    it('blocks the library for an account without the reader role', async () => {
      const registered = await api.register(TestDataBuilder.createUser({ roles: ['buyer'] }));
      api.setToken(registered.body.token);

      const books = await api.getBooks();
      const stats = await api.getStats();

      expect(books.status).toBe(403);
      expect(books.body.code).toBe('ROLE_REQUIRED');
      expect(books.body.context).toBe('library');
      expect(stats.status).toBe(403);
    });

    it('opens the library once the reader role is added', async () => {
      const registered = await api.register(TestDataBuilder.createUser({ roles: ['buyer'] }));
      api.setToken(registered.body.token);

      const updated = await api.call('patch', '/me/roles', { add: ['reader'] });
      expect(updated.status).toBe(200);
      api.setToken(updated.body.token);

      expect((await api.getBooks()).status).toBe(200);
    });
  });

  describe('GET /api/me', () => {
    it('returns the profile with roles and companies', async () => {
      const registered = await api.register(TestDataBuilder.createUser({ roles: ['reader', 'buyer'] }));
      api.setToken(registered.body.token);

      const response = await api.call('get', '/me');

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe(registered.body.user.email);
      expect(response.body.user.roles.sort()).toEqual(['buyer', 'reader']);
      expect(response.body.companies).toEqual([]);
    });

    it('requires authentication', async () => {
      const response = await api.call('get', '/me');

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/me/roles', () => {
    it('adds and removes roles and returns a token carrying them', async () => {
      const registered = await api.register(TestDataBuilder.createUser());
      api.setToken(registered.body.token);

      const response = await api.call('patch', '/me/roles', { add: ['buyer'], remove: ['reader'] });

      expect(response.status).toBe(200);
      expect(response.body.user.roles).toEqual(['buyer']);
      api.setToken(response.body.token);
      expect((await api.getBooks()).status).toBe(403);
    });

    it('refuses to leave the account without any role', async () => {
      const registered = await api.register(TestDataBuilder.createUser());
      api.setToken(registered.body.token);

      const response = await api.call('patch', '/me/roles', { remove: ['reader'] });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ROLE_REQUIRED_MINIMUM');
    });

    it('keeps the buyer role while the account is a seller', async () => {
      const registered = await api.register(TestDataBuilder.createUser({ roles: ['seller'] }));
      api.setToken(registered.body.token);

      const response = await api.call('patch', '/me/roles', { add: ['reader'], remove: ['buyer'] });

      expect(response.body.user.roles.sort()).toEqual(['buyer', 'reader', 'seller']);
    });

    it('does not accept the admin role', async () => {
      const registered = await api.register(TestDataBuilder.createUser());
      api.setToken(registered.body.token);

      const response = await api.call('patch', '/me/roles', { add: ['admin'] });

      expect(response.status).toBe(400);
    });

    it('rejects an empty change', async () => {
      const registered = await api.register(TestDataBuilder.createUser());
      api.setToken(registered.body.token);

      const response = await api.call('patch', '/me/roles', {});

      expect(response.status).toBe(400);
    });
  });

  describe('error responses', () => {
    it('carry the context and a request id that matches the response header', async () => {
      const response = await api.call('get', '/books');

      expect(response.status).toBe(401);
      expect(response.body.context).toBe('library');
      expect(response.body.requestId).toEqual(response.headers['x-request-id']);
    });
  });
});
