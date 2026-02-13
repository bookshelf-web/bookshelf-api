import { ApiClient } from '../../helpers/apiClient';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';

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

  describe('Cenários de Sucesso', () => {
    it('deve fazer login com credenciais válidas', async () => {
      const userData = TestDataBuilder.createUser();
      
      // Criar usuário primeiro
      await apiClient.register(userData);

      // Fazer login
      const response = await apiClient.login({
        email: userData.email,
        password: userData.password,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login realizado com sucesso');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    });
  });

  describe('Cenários de Validação', () => {
    it('deve retornar erro 400 quando email não for fornecido', async () => {
      const response = await apiClient.login({
        password: 'senha123',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('obrigatório');
    });

    it('deve retornar erro 400 quando senha não for fornecida', async () => {
      const response = await apiClient.login({
        email: 'test@test.com',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('obrigatório');
    });
  });

  describe('Cenários de Autenticação', () => {
    it('deve retornar erro 401 quando email não existir', async () => {
      const response = await apiClient.login({
        email: 'naoexiste@test.com',
        password: 'senha123',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/credenciais.*inválidas/i);
    });

    it('deve retornar erro 401 quando senha estiver incorreta', async () => {
      const userData = TestDataBuilder.createUser();
      
      // Criar usuário
      await apiClient.register(userData);

      // Tentar login com senha errada
      const response = await apiClient.login({
        email: userData.email,
        password: 'senhaerrada',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/credenciais.*inválidas/i);
    });

    it('não deve expor se o email existe ou não (mesmo erro para ambos)', async () => {
      const userData = TestDataBuilder.createUser();
      await apiClient.register(userData);

      // Tentar com email inexistente
      const response1 = await apiClient.login({
        email: 'naoexiste@test.com',
        password: 'senha123',
      });

      // Tentar com senha errada
      const response2 = await apiClient.login({
        email: userData.email,
        password: 'senhaerrada',
      });

      expect(response1.status).toBe(401);
      expect(response2.status).toBe(401);
      expect(response1.body.error).toBe(response2.body.error);
    });
  });

  describe('Cenários de Segurança', () => {
    it('não deve retornar a senha no response', async () => {
      const userData = TestDataBuilder.createUser();
      await apiClient.register(userData);

      const response = await apiClient.login({
        email: userData.email,
        password: userData.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('deve gerar token diferente a cada login', async () => {
      const userData = TestDataBuilder.createUser();
      await apiClient.register(userData);

      const response1 = await apiClient.login({
        email: userData.email,
        password: userData.password,
      });

      // Aguardar 1 segundo para garantir timestamp diferente
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response2 = await apiClient.login({
        email: userData.email,
        password: userData.password,
      });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.token).not.toBe(response2.body.token);
    });
  });
});