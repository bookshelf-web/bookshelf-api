import { ApiClient } from '../../helpers/apiClient';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

describe('POST /api/auth/login', () => {
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
    it('logs in with valid credentials', async () => {
      const userData = TestDataBuilder.createUser();
      await apiClient.register(userData);

      const response = await apiClient.login({
        email: userData.email,
        password: userData.password,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(typeof response.body.token).toBe('string');
    });
  });

  describe('validation', () => {
    it('returns 400 when email is missing', async () => {
      const response = await apiClient.login({ password: 'secret123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/email is required/i);
    });

    it('returns 400 when password is missing', async () => {
      const response = await apiClient.login({ email: 'test@test.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/password is required/i);
    });
  });

  describe('authentication', () => {
    it('returns 401 when the email does not exist', async () => {
      const response = await apiClient.login({
        email: 'missing@test.com',
        password: 'secret123',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid credentials/i);
    });

    it('returns 401 when the password is wrong', async () => {
      const userData = TestDataBuilder.createUser();
      await apiClient.register(userData);

      const response = await apiClient.login({
        email: userData.email,
        password: 'wrong-password',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid credentials/i);
    });

    it('does not reveal whether the email exists', async () => {
      const userData = TestDataBuilder.createUser();
      await apiClient.register(userData);

      const unknownEmail = await apiClient.login({
        email: 'missing@test.com',
        password: 'secret123',
      });
      const wrongPassword = await apiClient.login({
        email: userData.email,
        password: 'wrong-password',
      });

      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.body.error).toBe(wrongPassword.body.error);
    });
  });

  describe('security', () => {
    it('never returns the password', async () => {
      const userData = TestDataBuilder.createUser();
      await apiClient.register(userData);

      const response = await apiClient.login({
        email: userData.email,
        password: userData.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('returns a different token on each login', async () => {
      const userData = TestDataBuilder.createUser();
      await apiClient.register(userData);

      const first = await apiClient.login({
        email: userData.email,
        password: userData.password,
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const second = await apiClient.login({
        email: userData.email,
        password: userData.password,
      });

      expect(first.body.token).not.toBe(second.body.token);
    });
  });
});
