import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';
import booksFixture from '../../fixtures/books.json';

describe('POST /api/books', () => {
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
    it('deve criar livro com todos os campos', async () => {
      await authHelper.getAuthenticatedClient();
      const bookData = TestDataBuilder.createBook();

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Livro criado com sucesso');
      expect(response.body).toHaveProperty('book');
      expect(response.body.book).toHaveProperty('id');
      expect(response.body.book).toHaveProperty('title', bookData.title);
      expect(response.body.book).toHaveProperty('author', bookData.author);
      expect(response.body.book).toHaveProperty('isbn', bookData.isbn);
      expect(response.body.book).toHaveProperty('status', 'to_read');
      expect(response.body.book).toHaveProperty('createdAt');
    });

    it('deve criar livro apenas com campos obrigatórios', async () => {
      await authHelper.getAuthenticatedClient();
      const bookData = {
        title: 'Test Book',
        author: 'Test Author',
      };

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book).toHaveProperty('title', bookData.title);
      expect(response.body.book).toHaveProperty('author', bookData.author);
    });

    it('deve criar livro sem ISBN', async () => {
      await authHelper.getAuthenticatedClient();
      const bookData = TestDataBuilder.createBook({ isbn: undefined });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.isbn).toBeNull();
    });
  });

  describe('Cenários de Autorização', () => {
    it('deve retornar erro 401 quando não enviar token', async () => {
      const bookData = TestDataBuilder.createBook();

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('deve retornar erro 401 quando enviar token inválido', async () => {
      apiClient.setToken('token-invalido');
      const bookData = TestDataBuilder.createBook();

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Cenários de Validação', () => {
    beforeEach(async () => {
      await authHelper.getAuthenticatedClient();
    });

    it('deve retornar erro 400 quando título não for fornecido', async () => {
      const bookData = TestDataBuilder.createBook({ title: undefined });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/título.*obrigatório/i);
    });

    it('deve retornar erro 400 quando autor não for fornecido', async () => {
      const bookData = TestDataBuilder.createBook({ author: undefined });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/autor.*obrigatório/i);
    });

    it('deve retornar erro 400 quando ano de publicação for no futuro', async () => {
      const bookData = TestDataBuilder.createBook({ publishedYear: 2030 });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/ano.*futuro/i);
    });
  });

  describe('Cenários de Regras de Negócio', () => {
    beforeEach(async () => {
      await authHelper.getAuthenticatedClient();
    });

    it('deve retornar erro 409 quando ISBN já estiver cadastrado', async () => {
      const bookData = TestDataBuilder.createBook();

      // Criar primeiro livro
      await apiClient.createBook(bookData);

      // Tentar criar segundo livro com mesmo ISBN
      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/isbn.*cadastrado/i);
    });

    it('deve criar livros com ISBNs diferentes', async () => {
      const book1 = TestDataBuilder.createBook();
      const book2 = TestDataBuilder.createBook();

      const response1 = await apiClient.createBook(book1);
      const response2 = await apiClient.createBook(book2);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.book.isbn).not.toBe(response2.body.book.isbn);
    });

    it('deve permitir criar livros sem ISBN (duplicatas permitidas)', async () => {
      const book1 = TestDataBuilder.createBook({ isbn: undefined });
      const book2 = TestDataBuilder.createBook({ isbn: undefined });

      const response1 = await apiClient.createBook(book1);
      const response2 = await apiClient.createBook(book2);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
    });
  });

  describe('Cenários de Isolamento de Usuários', () => {
    it('livros devem ser associados ao usuário correto', async () => {
      // Usuário 1
      const client1 = await authHelper.getAuthenticatedClient();
      const book1 = TestDataBuilder.createBook();
      const response1 = await client1.createBook(book1);

      // Usuário 2
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
      const book2 = TestDataBuilder.createBook();
      const response2 = await client2.createBook(book2);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.book.userId).not.toBe(response2.body.book.userId);
    });
  });
});