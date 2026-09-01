import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

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

    // a fresh book for each test
    await authHelper.getAuthenticatedClient();
    const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
    bookId = createResponse.body.book.id;
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('success', () => {
    it('updates status to reading', async () => {
      const response = await apiClient.updateBookStatus(bookId, 'reading');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Book status updated successfully');
      expect(response.body.book.status).toBe('reading');
    });

    it('updates status to read', async () => {
      const response = await apiClient.updateBookStatus(bookId, 'read');

      expect(response.status).toBe(200);
      expect(response.body.book.status).toBe('read');
    });

    it('updates status back to to_read', async () => {
      // first move to reading
      await apiClient.updateBookStatus(bookId, 'reading');

      // then move back to to_read
      const response = await apiClient.updateBookStatus(bookId, 'to_read');

      expect(response.status).toBe(200);
      expect(response.body.book.status).toBe('to_read');
    });
  });

  describe('business rules - automatic dates', () => {
    it('sets startedAt automatically when moving to reading', async () => {
      const response = await apiClient.updateBookStatus(bookId, 'reading');

      expect(response.status).toBe(200);
      expect(response.body.book.status).toBe('reading');
      expect(response.body.book.startedAt).toBeDefined();
      expect(response.body.book.startedAt).not.toBeNull();

      // it is a valid date
      const startedDate = new Date(response.body.book.startedAt);
      expect(startedDate.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('sets finishedAt automatically when moving to read', async () => {
      const response = await apiClient.updateBookStatus(bookId, 'read');

      expect(response.status).toBe(200);
      expect(response.body.book.status).toBe('read');
      expect(response.body.book.finishedAt).toBeDefined();
      expect(response.body.book.finishedAt).not.toBeNull();

      // it is a valid date
      const finishedDate = new Date(response.body.book.finishedAt);
      expect(finishedDate.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('does not change startedAt if it is already set', async () => {
      // move to reading for the first time
      const firstResponse = await apiClient.updateBookStatus(bookId, 'reading');
      const originalStartedAt = firstResponse.body.book.startedAt;

      // wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      // back to to_read, then reading again
      await apiClient.updateBookStatus(bookId, 'to_read');
      const secondResponse = await apiClient.updateBookStatus(bookId, 'reading');

      expect(secondResponse.body.book.startedAt).toBe(originalStartedAt);
    });

    it('does not change finishedAt if it is already set', async () => {
      // move to read for the first time
      const firstResponse = await apiClient.updateBookStatus(bookId, 'read');
      const originalFinishedAt = firstResponse.body.book.finishedAt;

      // wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      // back to reading, then read again
      await apiClient.updateBookStatus(bookId, 'reading');
      const secondResponse = await apiClient.updateBookStatus(bookId, 'read');

      expect(secondResponse.body.book.finishedAt).toBe(originalFinishedAt);
    });

    it('keeps finishedAt >= startedAt', async () => {
      // first mark as reading
      await apiClient.updateBookStatus(bookId, 'reading');

      // small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // then mark as read
      const response = await apiClient.updateBookStatus(bookId, 'read');

      const startedAt = new Date(response.body.book.startedAt).getTime();
      const finishedAt = new Date(response.body.book.finishedAt).getTime();

      expect(finishedAt).toBeGreaterThanOrEqual(startedAt);
    });
  });

  describe('validation', () => {
    it('returns 400 for an invalid status', async () => {
      const response = await apiClient.updateBookStatus(bookId, 'invalid_status');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid status/i);
    });

    it('returns 400 when status is missing', async () => {
      const response = await apiClient.updateBookStatus(bookId, '');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('accepts only to_read, reading and read', async () => {
      const validStatuses = ['to_read', 'reading', 'read'];

      for (const status of validStatuses) {
        const response = await apiClient.updateBookStatus(bookId, status);
        expect(response.status).toBe(200);
      }
    });
  });

  describe('error cases', () => {
    it('returns 404 when the book does not exist', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await apiClient.updateBookStatus(fakeId, 'reading');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 404 when updating a book owned by another user', async () => {
      // user 2 tries to update user 1's book status
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());

      const response = await client2.updateBookStatus(bookId, 'reading');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('authorization', () => {
    it('returns 401 without a token', async () => {
      apiClient.clearToken();

      const response = await apiClient.updateBookStatus(bookId, 'reading');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('full flow', () => {
    it('follows the full flow to_read -> reading -> read', async () => {
      // initial state
      let book = await apiClient.getBookById(bookId);
      expect(book.body.book.status).toBe('to_read');
      expect(book.body.book.startedAt).toBeNull();
      expect(book.body.book.finishedAt).toBeNull();

      // move to reading
      await apiClient.updateBookStatus(bookId, 'reading');
      book = await apiClient.getBookById(bookId);
      expect(book.body.book.status).toBe('reading');
      expect(book.body.book.startedAt).not.toBeNull();
      expect(book.body.book.finishedAt).toBeNull();

      // move to read
      await apiClient.updateBookStatus(bookId, 'read');
      book = await apiClient.getBookById(bookId);
      expect(book.body.book.status).toBe('read');
      expect(book.body.book.startedAt).not.toBeNull();
      expect(book.body.book.finishedAt).not.toBeNull();
    });
  });
});
