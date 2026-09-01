import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

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

  describe('success', () => {
    it('creates a book with every field', async () => {
      await authHelper.getAuthenticatedClient();
      const bookData = TestDataBuilder.createBook();

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Book created successfully');
      expect(response.body.book).toHaveProperty('id');
      expect(response.body.book).toHaveProperty('title', bookData.title);
      expect(response.body.book).toHaveProperty('author', bookData.author);
      expect(response.body.book).toHaveProperty('isbn', bookData.isbn);
      expect(response.body.book).toHaveProperty('status', 'to_read');
      expect(response.body.book).toHaveProperty('createdAt');
    });

    it('creates a book with only the required fields', async () => {
      await authHelper.getAuthenticatedClient();
      const bookData = { title: 'Test Book', author: 'Test Author' };

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book).toHaveProperty('title', bookData.title);
      expect(response.body.book).toHaveProperty('author', bookData.author);
    });

    it('creates a book without an ISBN', async () => {
      await authHelper.getAuthenticatedClient();
      const bookData = TestDataBuilder.createBook({ isbn: undefined });

      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(201);
      expect(response.body.book.isbn).toBeNull();
    });
  });

  describe('authorization', () => {
    it('returns 401 without a token', async () => {
      const response = await apiClient.createBook(TestDataBuilder.createBook());

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 401 with an invalid token', async () => {
      apiClient.setToken('invalid-token');

      const response = await apiClient.createBook(TestDataBuilder.createBook());

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('validation', () => {
    beforeEach(async () => {
      await authHelper.getAuthenticatedClient();
    });

    it('returns 400 when title is missing', async () => {
      const response = await apiClient.createBook(TestDataBuilder.createBook({ title: undefined }));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/title is required/i);
    });

    it('returns 400 when author is missing', async () => {
      const response = await apiClient.createBook(
        TestDataBuilder.createBook({ author: undefined }),
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/author is required/i);
    });

    it('returns 400 when the published year is in the future', async () => {
      const response = await apiClient.createBook(
        TestDataBuilder.createBook({ publishedYear: 2030 }),
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/year.*future/i);
    });
  });

  describe('business rules', () => {
    beforeEach(async () => {
      await authHelper.getAuthenticatedClient();
    });

    it('returns 409 when the ISBN is already registered', async () => {
      const bookData = TestDataBuilder.createBook();

      await apiClient.createBook(bookData);
      const response = await apiClient.createBook(bookData);

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/isbn.*already registered/i);
    });

    it('allows books with different ISBNs', async () => {
      const response1 = await apiClient.createBook(TestDataBuilder.createBook());
      const response2 = await apiClient.createBook(TestDataBuilder.createBook());

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.book.isbn).not.toBe(response2.body.book.isbn);
    });

    it('allows multiple books without an ISBN', async () => {
      const response1 = await apiClient.createBook(TestDataBuilder.createBook({ isbn: undefined }));
      const response2 = await apiClient.createBook(TestDataBuilder.createBook({ isbn: undefined }));

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
    });
  });

  describe('user isolation', () => {
    it('associates the book with the authenticated user', async () => {
      const client1 = await authHelper.getAuthenticatedClient();
      const response1 = await client1.createBook(TestDataBuilder.createBook());

      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
      const response2 = await client2.createBook(TestDataBuilder.createBook());

      expect(response1.body.book.userId).not.toBe(response2.body.book.userId);
    });
  });
});
