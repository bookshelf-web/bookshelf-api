import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

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

    // a fresh book for each test
    await authHelper.getAuthenticatedClient();
    const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
    bookId = createResponse.body.book.id;
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('success', () => {
    it('updates the book title', async () => {
      const updateData = { title: 'New Title' };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Book updated successfully');
      expect(response.body.book.title).toBe(updateData.title);
    });

    it('updates the book author', async () => {
      const updateData = { author: 'New Author' };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(200);
      expect(response.body.book.author).toBe(updateData.author);
    });

    it('updates multiple fields at once', async () => {
      const updateData = {
        title: 'Updated Title',
        author: 'Updated Author',
        pages: 500,
        publishedYear: 2021,
        publisher: 'New Publisher',
      };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(200);
      expect(response.body.book.title).toBe(updateData.title);
      expect(response.body.book.author).toBe(updateData.author);
      expect(response.body.book.pages).toBe(updateData.pages);
      expect(response.body.book.publishedYear).toBe(updateData.publishedYear);
      expect(response.body.book.publisher).toBe(updateData.publisher);
    });

    it('adds rating and notes', async () => {
      const updateData = {
        rating: 5,
        notes: 'Excellent book!',
      };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(200);
      expect(response.body.book.rating).toBe(5);
      expect(response.body.book.notes).toBe(updateData.notes);
    });

    it('updates the ISBN', async () => {
      const newISBN = TestDataBuilder.generateUniqueISBN();
      const updateData = { isbn: newISBN };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(200);
      expect(response.body.book.isbn).toBe(newISBN);
    });

    it('updates the updatedAt field', async () => {
      // original data
      const originalResponse = await apiClient.getBookById(bookId);
      const originalUpdatedAt = originalResponse.body.book.updatedAt;

      // wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      // update the book
      await apiClient.updateBook(bookId, { title: 'New Title' });

      // updatedAt changed
      const updatedResponse = await apiClient.getBookById(bookId);
      expect(updatedResponse.body.book.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('validation', () => {
    it('returns 400 when rating is below 1', async () => {
      const updateData = { rating: 0 };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/rating/i);
    });

    it('returns 400 when rating is above 5', async () => {
      const updateData = { rating: 6 };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/rating/i);
    });

    it('returns 400 when the published year is in the future', async () => {
      const updateData = { publishedYear: 2030 };

      const response = await apiClient.updateBook(bookId, updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/year.*future/i);
    });
  });

  describe('business rules', () => {
    it('returns 409 when the ISBN belongs to another book', async () => {
      // create a second book
      const book2 = await apiClient.createBook(TestDataBuilder.createBook());
      const book2ISBN = book2.body.book.isbn;

      // try to set the first book's ISBN to the second's
      const response = await apiClient.updateBook(bookId, { isbn: book2ISBN });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/isbn.*already registered/i);
    });

    it('allows keeping the same ISBN', async () => {
      const originalBook = await apiClient.getBookById(bookId);
      const originalISBN = originalBook.body.book.isbn;

      const response = await apiClient.updateBook(bookId, {
        isbn: originalISBN,
        title: 'New Title',
      });

      expect(response.status).toBe(200);
      expect(response.body.book.isbn).toBe(originalISBN);
    });
  });

  describe('error cases', () => {
    it('returns 404 when the book does not exist', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await apiClient.updateBook(fakeId, { title: 'New Title' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 404 when updating a book owned by another user', async () => {
      // user 2 tries to update user 1's book
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());

      const response = await client2.updateBook(bookId, { title: 'Hack' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('authorization', () => {
    it('returns 401 without a token', async () => {
      apiClient.clearToken();

      const response = await apiClient.updateBook(bookId, { title: 'Novo' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});
