import { ApiClient } from '../../helpers/apiClient';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';
import usersFixture from '../../fixtures/users.json';

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

  describe('Cenários de Sucesso', () => {
    it('deve criar usuário com dados válidos', async () => {
      const userData = TestDataBuilder.createUser();

      const response = await apiClient.register(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Usuário criado com sucesso');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('name', userData.name);
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    });

    it('deve criar múltiplos usuários com emails diferentes', async () => {
      const user1 = TestDataBuilder.createUser();
      const user2 = TestDataBuilder.createUser();

      const response1 = await apiClient.register(user1);
      const response2 = await apiClient.register(user2);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.user.email).not.toBe(response2.body.user.email);
    });
  });

  describe('Cenários de Validação', () => {
    it('deve retornar erro 400 quando nome não for fornecido', async () => {
      const userData = TestDataBuilder.createUser({ name: undefined });

      const response = await apiClient.register(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('obrigatório');
    });

    it('deve retornar erro 400 quando email não for fornecido', async () => {
      const userData = TestDataBuilder.createUser({ email: undefined });

      const response = await apiClient.register(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('obrigatório');
    });

    it('deve retornar erro 400 quando senha não for fornecida', async () => {
      const userData = TestDataBuilder.createUser({ password: undefined });

      const response = await apiClient.register(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('obrigatório');
    });

    it('deve retornar erro 400 quando senha tiver menos de 6 caracteres', async () => {
      const userData = TestDataBuilder.createUser({ password: '12345' });

      const response = await apiClient.register(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/senha|mínimo|6/i);
    });

    it('deve retornar erro 400 quando todos os campos estiverem vazios', async () => {
      const response = await apiClient.register({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Cenários de Regras de Negócio', () => {
    it('deve retornar erro 409 quando email já estiver cadastrado', async () => {
      const userData = TestDataBuilder.createUser();

      // Primeiro registro - deve funcionar
      await apiClient.register(userData);

      // Segundo registro com mesmo email - deve falhar
      const response = await apiClient.register(userData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/email.*cadastrado/i);
    });
  });

  describe('Cenários de Segurança', () => {
    it('não deve retornar a senha no response', async () => {
      const userData = TestDataBuilder.createUser();

      const response = await apiClient.register(userData);

      expect(response.status).toBe(201);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('deve gerar token JWT válido', async () => {
      const userData = TestDataBuilder.createUser();

      const response = await apiClient.register(userData);

      expect(response.status).toBe(201);
      expect(response.body.token).toBeDefined();
      // JWT tem 3 partes separadas por ponto
      expect(response.body.token.split('.')).toHaveLength(3);
    });
  });
});