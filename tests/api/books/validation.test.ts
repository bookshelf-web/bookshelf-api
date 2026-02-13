import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';

describe('Books - Validações Adicionais', () => {
  let apiClient: ApiClient;
  let authHelper: AuthHelper;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    apiClient = new ApiClient();
    authHelper = new AuthHelper(apiClient);
    await cleanupTestDatabase();
    await authHelper.getAuthenticatedClient();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Validações de Campos de Texto', () => {
    it('deve aceitar título com caracteres especiais', async () => {
      const bookData = TestDataBuilder.createBook({
        title: 'C++ Programming: The Complete Guide!!! @2024'
      });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.title).toContain('C++');
      expect(response.body.book.title).toContain('!!!');
      expect(response.body.book.title).toContain('@');
    });

    it('deve aceitar autor com caracteres acentuados', async () => {
      const bookData = TestDataBuilder.createBook({
        author: 'José María González Sánchez'
      });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.author).toBe('José María González Sánchez');
    });

    it('deve aceitar descrição longa', async () => {
      const longDescription = 'A'.repeat(1000);
      const bookData = TestDataBuilder.createBook({
        description: longDescription
      });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.description).toBe(longDescription);
    });

    it('deve aceitar notas longas', async () => {
      const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
      const bookId = createResponse.body.book.id;

      const longNotes = 'Nota muito longa. '.repeat(100);
      const response = await apiClient.updateBook(bookId, { notes: longNotes });

      expect(response.status).toBe(200);
      expect(response.body.book.notes).toBe(longNotes);
    });
  });

  describe('Validações de Números', () => {
    it('deve aceitar páginas = 0', async () => {
      const bookData = TestDataBuilder.createBook({ pages: 0 });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.pages).toBe(0);
    });

    it('deve aceitar páginas com número muito grande', async () => {
      const bookData = TestDataBuilder.createBook({ pages: 99999 });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.pages).toBe(99999);
    });

    it('deve aceitar ano de publicação muito antigo', async () => {
      const bookData = TestDataBuilder.createBook({ publishedYear: 1000 });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.publishedYear).toBe(1000);
    });

    it('deve aceitar ano de publicação do ano atual', async () => {
      const currentYear = new Date().getFullYear();
      const bookData = TestDataBuilder.createBook({ publishedYear: currentYear });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.publishedYear).toBe(currentYear);
    });
  });

  describe('Validações de ISBN', () => {
    it('deve aceitar ISBN-10 válido', async () => {
      const bookData = TestDataBuilder.createBook({ isbn: '0132350882' });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.isbn).toBe('0132350882');
    });

    it('deve aceitar ISBN-13 válido', async () => {
      const bookData = TestDataBuilder.createBook({ isbn: '9780132350884' });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.isbn).toBe('9780132350884');
    });
  });

  describe('Validações de Rating', () => {
    it('deve aceitar rating = 1', async () => {
      const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
      const response = await apiClient.updateBook(createResponse.body.book.id, { rating: 1 });

      expect(response.status).toBe(200);
      expect(response.body.book.rating).toBe(1);
    });

    it('deve aceitar rating = 5', async () => {
      const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
      const response = await apiClient.updateBook(createResponse.body.book.id, { rating: 5 });

      expect(response.status).toBe(200);
      expect(response.body.book.rating).toBe(5);
    });

    it('deve aceitar rating = 3', async () => {
      const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
      const response = await apiClient.updateBook(createResponse.body.book.id, { rating: 3 });

      expect(response.status).toBe(200);
      expect(response.body.book.rating).toBe(3);
    });
  });

  describe('Validações de Idioma', () => {
    it('deve aceitar diferentes códigos de idioma', async () => {
      const languages = ['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE'];

      for (const lang of languages) {
        const bookData = TestDataBuilder.createBook({ language: lang });
        const response = await apiClient.createBook(bookData);

        expect(response.status).toBe(201);
        expect(response.body.book.language).toBe(lang);
      }
    });
  });

  describe('Validações de URL', () => {
    it('deve aceitar URL de capa válida', async () => {
      const bookData = TestDataBuilder.createBook({
        coverUrl: 'https://example.com/covers/book-cover.jpg'
      });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.coverUrl).toBe('https://example.com/covers/book-cover.jpg');
    });

    it('deve aceitar URL com parâmetros', async () => {
      const bookData = TestDataBuilder.createBook({
        coverUrl: 'https://cdn.example.com/image?id=123&size=large&format=jpg'
      });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.coverUrl).toContain('?id=123');
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com request vazio', async () => {
      const response = await apiClient.createBook({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('deve lidar com campos null', async () => {
      const bookData = {
        title: 'Test Book',
        author: 'Test Author',
        pages: null,
        publishedYear: null
      };

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
    });
  });
});