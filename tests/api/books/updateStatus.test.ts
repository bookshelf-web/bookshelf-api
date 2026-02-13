import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';

describe('PATCH /api/books/:id/status', () => {
  let apiClient: ApiClient;
  let authHelper: AuthHelper;
  let bookId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    apiClient = new ApiClient();
    authHelper = new AuthHelper(apiClient);
    await cleanupTestDatabase();

    // Criar um livro para cada teste
    await authHelper.getAuthenticatedClient();
    const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
    bookId = createResponse.body.book.id;
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Cenários de Sucesso', () => {
    it('deve atualizar status para "reading"', async () => {
      const response = await apiClient.updateBookStatus(bookId, 'reading');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Status atualizado com sucesso');
      expect(response.body.book.status).toBe('reading');
    });

    it('deve atualizar status para "read"', async () => {
      const response = await apiClient.updateBookStatus(bookId, 'read');

      expect(response.status).toBe(200);
      expect(response.body.book.status).toBe('read');
    });

    it('deve atualizar status de volta para "to_read"', async () => {
      // Primeiro mudar para reading
      await apiClient.updateBookStatus(bookId, 'reading');

      // Depois voltar para to_read
      const response = await apiClient.updateBookStatus(bookId, 'to_read');

      expect(response.status).toBe(200);
      expect(response.body.book.status).toBe('to_read');
    });
  });

  describe('Cenários de Regras de Negócio - Datas Automáticas', () => {
    it('deve preencher startedAt automaticamente ao mudar para "reading"', async () => {
      const response = await apiClient.updateBookStatus(bookId, 'reading');

      expect(response.status).toBe(200);
      expect(response.body.book.status).toBe('reading');
      expect(response.body.book.startedAt).toBeDefined();
      expect(response.body.book.startedAt).not.toBeNull();
      
      // Verificar que é uma data válida
      const startedDate = new Date(response.body.book.startedAt);
      expect(startedDate.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('deve preencher finishedAt automaticamente ao mudar para "read"', async () => {
      const response = await apiClient.updateBookStatus(bookId, 'read');

      expect(response.status).toBe(200);
      expect(response.body.book.status).toBe('read');
      expect(response.body.book.finishedAt).toBeDefined();
      expect(response.body.book.finishedAt).not.toBeNull();
      
      // Verificar que é uma data válida
      const finishedDate = new Date(response.body.book.finishedAt);
      expect(finishedDate.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('NÃO deve alterar startedAt se já existir', async () => {
      // Mudar para reading pela primeira vez
      const firstResponse = await apiClient.updateBookStatus(bookId, 'reading');
      const originalStartedAt = firstResponse.body.book.startedAt;

      // Aguardar 1 segundo
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Voltar para to_read e depois reading novamente
      await apiClient.updateBookStatus(bookId, 'to_read');
      const secondResponse = await apiClient.updateBookStatus(bookId, 'reading');

      expect(secondResponse.body.book.startedAt).toBe(originalStartedAt);
    });

    it('NÃO deve alterar finishedAt se já existir', async () => {
      // Mudar para read pela primeira vez
      const firstResponse = await apiClient.updateBookStatus(bookId, 'read');
      const originalFinishedAt = firstResponse.body.book.finishedAt;

      // Aguardar 1 segundo
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Voltar para reading e depois read novamente
      await apiClient.updateBookStatus(bookId, 'reading');
      const secondResponse = await apiClient.updateBookStatus(bookId, 'read');

      expect(secondResponse.body.book.finishedAt).toBe(originalFinishedAt);
    });

    it('deve ter finishedAt >= startedAt quando mudar para "read" após "reading"', async () => {
      // Primeiro marcar como reading
      await apiClient.updateBookStatus(bookId, 'reading');

      // Aguardar um pouco
      await new Promise(resolve => setTimeout(resolve, 100));

      // Depois marcar como read
      const response = await apiClient.updateBookStatus(bookId, 'read');

      const startedAt = new Date(response.body.book.startedAt).getTime();
      const finishedAt = new Date(response.body.book.finishedAt).getTime();

      expect(finishedAt).toBeGreaterThanOrEqual(startedAt);
    });
  });

  describe('Cenários de Validação', () => {
    it('deve retornar erro 400 quando status for inválido', async () => {
      const response = await apiClient.updateBookStatus(bookId, 'invalid_status');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/status.*inválido/i);
    });

    it('deve retornar erro 400 quando status não for fornecido', async () => {
      const response = await apiClient.updateBookStatus(bookId, '');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('deve aceitar apenas valores: to_read, reading, read', async () => {
      const validStatuses = ['to_read', 'reading', 'read'];

      for (const status of validStatuses) {
        const response = await apiClient.updateBookStatus(bookId, status);
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Cenários de Erro', () => {
    it('deve retornar erro 404 quando livro não existe', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await apiClient.updateBookStatus(fakeId, 'reading');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('deve retornar erro 404 quando tentar atualizar livro de outro usuário', async () => {
      // Usuário 2 tenta atualizar status do livro do usuário 1
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
      
      const response = await client2.updateBookStatus(bookId, 'reading');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Cenários de Autorização', () => {
    it('deve retornar erro 401 quando não enviar token', async () => {
      apiClient.clearToken();

      const response = await apiClient.updateBookStatus(bookId, 'reading');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Cenários de Fluxo Completo', () => {
    it('deve seguir fluxo completo: to_read → reading → read', async () => {
      // Verificar estado inicial
      let book = await apiClient.getBookById(bookId);
      expect(book.body.book.status).toBe('to_read');
      expect(book.body.book.startedAt).toBeNull();
      expect(book.body.book.finishedAt).toBeNull();

      // Mudar para reading
      await apiClient.updateBookStatus(bookId, 'reading');
      book = await apiClient.getBookById(bookId);
      expect(book.body.book.status).toBe('reading');
      expect(book.body.book.startedAt).not.toBeNull();
      expect(book.body.book.finishedAt).toBeNull();

      // Mudar para read
      await apiClient.updateBookStatus(bookId, 'read');
      book = await apiClient.getBookById(bookId);
      expect(book.body.book.status).toBe('read');
      expect(book.body.book.startedAt).not.toBeNull();
      expect(book.body.book.finishedAt).not.toBeNull();
    });
  });
});