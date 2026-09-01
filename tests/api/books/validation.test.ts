import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

describe('Books - additional validations', () => {
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

  describe('text fields', () => {
    it('accepts a title with special characters', async () => {
      const bookData = TestDataBuilder.createBook({
        title: 'C++ Programming: The Complete Guide!!! @2024',
      });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.title).toContain('C++');
      expect(response.body.book.title).toContain('!!!');
      expect(response.body.book.title).toContain('@');
    });

    it('accepts an author with accented characters', async () => {
      const bookData = TestDataBuilder.createBook({
        author: 'José María González Sánchez',
      });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.author).toBe('José María González Sánchez');
    });

    it('accepts a long description', async () => {
      const longDescription = 'A'.repeat(1000);
      const bookData = TestDataBuilder.createBook({
        description: longDescription,
      });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.description).toBe(longDescription);
    });

    it('accepts long notes', async () => {
      const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
      const bookId = createResponse.body.book.id;

      const longNotes = 'A very long note. '.repeat(100);
      const response = await apiClient.updateBook(bookId, { notes: longNotes });

      expect(response.status).toBe(200);
      expect(response.body.book.notes).toBe(longNotes);
    });
  });

  describe('numeric fields', () => {
    it('accepts pages = 0', async () => {
      const bookData = TestDataBuilder.createBook({ pages: 0 });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.pages).toBe(0);
    });

    it('accepts a very large page count', async () => {
      const bookData = TestDataBuilder.createBook({ pages: 99999 });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.pages).toBe(99999);
    });

    it('accepts a very old published year', async () => {
      const bookData = TestDataBuilder.createBook({ publishedYear: 1000 });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.publishedYear).toBe(1000);
    });

    it('accepts the current year as published year', async () => {
      const currentYear = new Date().getFullYear();
      const bookData = TestDataBuilder.createBook({ publishedYear: currentYear });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.publishedYear).toBe(currentYear);
    });
  });

  describe('ISBN', () => {
    it('accepts a valid ISBN-10', async () => {
      const bookData = TestDataBuilder.createBook({ isbn: '0132350882' });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.isbn).toBe('0132350882');
    });

    it('accepts a valid ISBN-13', async () => {
      const bookData = TestDataBuilder.createBook({ isbn: '9780132350884' });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.isbn).toBe('9780132350884');
    });
  });

  describe('rating', () => {
    it('accepts rating = 1', async () => {
      const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
      const response = await apiClient.updateBook(createResponse.body.book.id, { rating: 1 });

      expect(response.status).toBe(200);
      expect(response.body.book.rating).toBe(1);
    });

    it('accepts rating = 5', async () => {
      const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
      const response = await apiClient.updateBook(createResponse.body.book.id, { rating: 5 });

      expect(response.status).toBe(200);
      expect(response.body.book.rating).toBe(5);
    });

    it('accepts rating = 3', async () => {
      const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
      const response = await apiClient.updateBook(createResponse.body.book.id, { rating: 3 });

      expect(response.status).toBe(200);
      expect(response.body.book.rating).toBe(3);
    });
  });

  describe('language', () => {
    it('accepts different language codes', async () => {
      const languages = ['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE'];

      for (const lang of languages) {
        const bookData = TestDataBuilder.createBook({ language: lang });
        const response = await apiClient.createBook(bookData);

        expect(response.status).toBe(201);
        expect(response.body.book.language).toBe(lang);
      }
    });
  });

  describe('URL', () => {
    it('accepts a valid cover URL', async () => {
      const bookData = TestDataBuilder.createBook({
        coverUrl: 'https://example.com/covers/book-cover.jpg',
      });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.coverUrl).toBe('https://example.com/covers/book-cover.jpg');
    });

    it('accepts a URL with query parameters', async () => {
      const bookData = TestDataBuilder.createBook({
        coverUrl: 'https://cdn.example.com/image?id=123&size=large&format=jpg',
      });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.coverUrl).toContain('?id=123');
    });
  });

  describe('edge cases', () => {
    it('handles an empty request body', async () => {
      const response = await apiClient.createBook({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('handles null fields', async () => {
      const bookData = {
        title: 'Test Book',
        author: 'Test Author',
        pages: null,
        publishedYear: null,
      };

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
    });
  });
});
