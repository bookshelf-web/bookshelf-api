import { ApiClient } from '../../helpers/apiClient';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

describe('POST /api/auth/register', () => {
  let apiClient: ApiClient;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    apiClient = new ApiClient();
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('success', () => {
    it('creates a user with valid data', async () => {
      const userData = TestDataBuilder.createUser();

      const response = await apiClient.register(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('name', userData.name);
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    });

    it('creates multiple users with different emails', async () => {
      const response1 = await apiClient.register(TestDataBuilder.createUser());
      const response2 = await apiClient.register(TestDataBuilder.createUser());

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.user.email).not.toBe(response2.body.user.email);
    });
  });

  describe('validation', () => {
    it('returns 400 when name is missing', async () => {
      const response = await apiClient.register(TestDataBuilder.createUser({ name: undefined }));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/name is required/i);
    });

    it('returns 400 when email is missing', async () => {
      const response = await apiClient.register(TestDataBuilder.createUser({ email: undefined }));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/email is required/i);
    });

    it('returns 400 when password is missing', async () => {
      const response = await apiClient.register(
        TestDataBuilder.createUser({ password: undefined }),
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/password is required/i);
    });

    it('returns 400 when password is shorter than 6 characters', async () => {
      const response = await apiClient.register(TestDataBuilder.createUser({ password: '12345' }));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/password|at least|6/i);
    });

    it('returns 400 when the body is empty', async () => {
      const response = await apiClient.register({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('business rules', () => {
    it('returns 409 when the email is already registered', async () => {
      const userData = TestDataBuilder.createUser();

      await apiClient.register(userData);
      const response = await apiClient.register(userData);

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/email.*already registered/i);
    });
  });

  describe('security', () => {
    it('never returns the password', async () => {
      const response = await apiClient.register(TestDataBuilder.createUser());

      expect(response.status).toBe(201);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('returns a well-formed JWT', async () => {
      const response = await apiClient.register(TestDataBuilder.createUser());

      expect(response.status).toBe(201);
      expect(response.body.token.split('.')).toHaveLength(3);
    });
  });
});
