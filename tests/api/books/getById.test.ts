import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';

describe('GET /api/books/:id', () => {
  let apiClient: ApiClient;
  let authHelper: AuthHelper;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    apiClient = new ApiClient();
    authHelper = new AuthHelper(apiClient);
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Cenários de Sucesso', () => {
    it('deve retornar livro existente', async () => {
      await authHelper.getAuthenticatedClient();
      
      const bookData = TestDataBuilder.createBook();
      const createResponse = await apiClient.createBook(bookData);
      const bookId = createResponse.body.book.id;

      const response = await apiClient.getBookById(bookId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('book');
      expect(response.body.book).toHaveProperty('id', bookId);
      expect(response.body.book).toHaveProperty('title', bookData.title);
      expect(response.body.book).toHaveProperty('author', bookData.author);
    });

    it('deve retornar todos os campos do livro', async () => {
      await authHelper.getAuthenticatedClient();
      
      const bookData = TestDataBuilder.createBook({
        title: 'Complete Book',
        author: 'Author Name',
        isbn: '9781234567890',
        publisher: 'Publisher',
        publishedYear: 2020,
        pages: 300,
        description: 'Test description'
      });

      const createResponse = await apiClient.createBook(bookData);
      const bookId = createResponse.body.book.id;

      const response = await apiClient.getBookById(bookId);

      expect(response.status).toBe(200);
      expect(response.body.book.title).toBe(bookData.title);
      expect(response.body.book.author).toBe(bookData.author);
      expect(response.body.book.isbn).toBe(bookData.isbn);
      expect(response.body.book.publisher).toBe(bookData.publisher);
      expect(response.body.book.publishedYear).toBe(bookData.publishedYear);
      expect(response.body.book.pages).toBe(bookData.pages);
      expect(response.body.book.description).toBe(bookData.description);
      expect(response.body.book).toHaveProperty('createdAt');
      expect(response.body.book).toHaveProperty('updatedAt');
    });
  });

  describe('Cenários de Erro', () => {
    it('deve retornar erro 404 quando livro não existe', async () => {
      await authHelper.getAuthenticatedClient();
      
      const fakeId = '550e8400-e29b-41d4-a716-446655440000'; // UUID válido mas inexistente

      const response = await apiClient.getBookById(fakeId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/não encontrado/i);
    });

    it('deve retornar erro 404 quando tentar acessar livro de outro usuário', async () => {
      // Usuário 1 cria um livro
      const client1 = await authHelper.getAuthenticatedClient();
      const createResponse = await client1.createBook(TestDataBuilder.createBook());
      const bookId = createResponse.body.book.id;

      // Usuário 2 tenta acessar livro do usuário 1
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
      const response = await client2.getBookById(bookId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Cenários de Autorização', () => {
    it('deve retornar erro 401 quando não enviar token', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await apiClient.getBookById(fakeId);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('deve retornar erro 401 quando enviar token inválido', async () => {
      apiClient.setToken('token-invalido');
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await apiClient.getBookById(fakeId);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});