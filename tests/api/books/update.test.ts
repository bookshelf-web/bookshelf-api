import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';

describe('PUT /api/books/:id', () => {
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
    it('deve atualizar título do livro', async () => {
      const updateData = { title: 'Novo Título' };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Livro atualizado com sucesso');
      expect(response.body.book.title).toBe(updateData.title);
    });

    it('deve atualizar autor do livro', async () => {
      const updateData = { author: 'Novo Autor' };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(200);
      expect(response.body.book.author).toBe(updateData.author);
    });

    it('deve atualizar múltiplos campos de uma vez', async () => {
      const updateData = {
        title: 'Título Atualizado',
        author: 'Autor Atualizado',
        pages: 500,
        publishedYear: 2021,
        publisher: 'Nova Editora'
      };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(200);
      expect(response.body.book.title).toBe(updateData.title);
      expect(response.body.book.author).toBe(updateData.author);
      expect(response.body.book.pages).toBe(updateData.pages);
      expect(response.body.book.publishedYear).toBe(updateData.publishedYear);
      expect(response.body.book.publisher).toBe(updateData.publisher);
    });

    it('deve adicionar rating e notas', async () => {
      const updateData = {
        rating: 5,
        notes: 'Livro excelente!'
      };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(200);
      expect(response.body.book.rating).toBe(5);
      expect(response.body.book.notes).toBe(updateData.notes);
    });

    it('deve atualizar ISBN', async () => {
      const newISBN = TestDataBuilder.generateUniqueISBN();
      const updateData = { isbn: newISBN };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(200);
      expect(response.body.book.isbn).toBe(newISBN);
    });

    it('deve atualizar campo updatedAt', async () => {
      // Pegar dados originais
      const originalResponse = await apiClient.getBookById(bookId);
      const originalUpdatedAt = originalResponse.body.book.updatedAt;

      // Aguardar 1 segundo
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Atualizar livro
      await apiClient.updateBook(bookId, { title: 'Novo Título' });

      // Verificar que updatedAt mudou
      const updatedResponse = await apiClient.getBookById(bookId);
      expect(updatedResponse.body.book.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('Cenários de Validação', () => {
    it('deve retornar erro 400 quando rating for menor que 1', async () => {
      const updateData = { rating: 0 };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/rating/i);
    });

    it('deve retornar erro 400 quando rating for maior que 5', async () => {
      const updateData = { rating: 6 };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/rating/i);
    });

    it('deve retornar erro 400 quando ano de publicação for no futuro', async () => {
      const updateData = { publishedYear: 2030 };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/ano.*futuro/i);
    });
  });

  describe('Cenários de Regras de Negócio', () => {
    it('deve retornar erro 409 quando ISBN já existe em outro livro', async () => {
      // Criar segundo livro
      const book2 = await apiClient.createBook(TestDataBuilder.createBook());
      const book2ISBN = book2.body.book.isbn;

      // Tentar atualizar primeiro livro com ISBN do segundo
      const response = await apiClient.updateBook(bookId, { isbn: book2ISBN });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/isbn.*cadastrado/i);
    });

    it('deve permitir atualizar mantendo o mesmo ISBN', async () => {
      const originalBook = await apiClient.getBookById(bookId);
      const originalISBN = originalBook.body.book.isbn;

      const response = await apiClient.updateBook(bookId, { 
        isbn: originalISBN,
        title: 'Novo Título'
      });

      expect(response.status).toBe(200);
      expect(response.body.book.isbn).toBe(originalISBN);
    });
  });

  describe('Cenários de Erro', () => {
    it('deve retornar erro 404 quando livro não existe', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await apiClient.updateBook(fakeId, { title: 'Novo Título' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('deve retornar erro 404 quando tentar atualizar livro de outro usuário', async () => {
      // Usuário 2 tenta atualizar livro do usuário 1
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
      
      const response = await client2.updateBook(bookId, { title: 'Hack' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Cenários de Autorização', () => {
    it('deve retornar erro 401 quando não enviar token', async () => {
      apiClient.clearToken();

      const response = await apiClient.updateBook(bookId, { title: 'Novo' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});