import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

describe('GET /api/books', () => {
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
    it('lists all of the books owned by the user', async () => {
      await authHelper.getAuthenticatedClient();

      // create a few books
      const book1 = TestDataBuilder.createBook({ title: 'Book 1' });
      const book2 = TestDataBuilder.createBook({ title: 'Book 2' });
      const book3 = TestDataBuilder.createBook({ title: 'Book 3' });

      await apiClient.createBook(book1);
      await apiClient.createBook(book2);
      await apiClient.createBook(book3);

      const response = await apiClient.getBooks();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('books');
      expect(response.body.books).toHaveLength(3);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.total).toBe(3);
    });

    it('returns an empty list when the user has no books', async () => {
      await authHelper.getAuthenticatedClient();

      const response = await apiClient.getBooks();

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });

    it('returns only the authenticated user’s books', async () => {
      // make sure the DB is clean before this test
      await cleanupTestDatabase();

      // user 1 creates 2 books
      const client1 = await authHelper.getAuthenticatedClient();
      await client1.createBook(TestDataBuilder.createBook());
      await client1.createBook(TestDataBuilder.createBook());

      // user 2 creates 3 books
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
      await client2.createBook(TestDataBuilder.createBook());
      await client2.createBook(TestDataBuilder.createBook());
      await client2.createBook(TestDataBuilder.createBook());

      // user 1 sees only their 2 books
      const response1 = await client1.getBooks();
      expect(response1.body.books).toHaveLength(2);

      // user 2 sees only their 3 books
      const response2 = await client2.getBooks();
      expect(response2.body.books).toHaveLength(3);
    });
  });

  describe('pagination', () => {
    beforeEach(async () => {
      await authHelper.getAuthenticatedClient();

      // create 15 books
      for (let i = 1; i <= 15; i++) {
        await apiClient.createBook(TestDataBuilder.createBook({ title: `Book ${i}` }));
      }
    });

    it('returns 10 books per page by default', async () => {
      const response = await apiClient.getBooks();

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(10);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(15);
      expect(response.body.pagination.totalPages).toBe(2);
    });

    it('returns the second page', async () => {
      const response = await apiClient.getBooks({ page: 2 });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(5);
      expect(response.body.pagination.page).toBe(2);
    });

    it('respects a custom limit', async () => {
      const response = await apiClient.getBooks({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(5);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.pagination.totalPages).toBe(3);
    });

    it('combines page and limit', async () => {
      const response = await apiClient.getBooks({ page: 2, limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(5);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('filtering', () => {
    beforeEach(async () => {
      await authHelper.getAuthenticatedClient();

      // books with different statuses
      await apiClient.createBook(TestDataBuilder.createBook({ title: 'To Read Book' }));

      const readingBook = await apiClient.createBook(
        TestDataBuilder.createBook({ title: 'Reading Book' }),
      );
      await apiClient.updateBookStatus(readingBook.body.book.id, 'reading');

      const readBook = await apiClient.createBook(
        TestDataBuilder.createBook({ title: 'Read Book' }),
      );
      await apiClient.updateBookStatus(readBook.body.book.id, 'read');
      await apiClient.updateBook(readBook.body.book.id, { rating: 5 });
    });

    it('filters by status to_read', async () => {
      const response = await apiClient.getBooks({ status: 'to_read' });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].status).toBe('to_read');
    });

    it('filters by status reading', async () => {
      const response = await apiClient.getBooks({ status: 'reading' });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].status).toBe('reading');
    });

    it('filters by status read', async () => {
      const response = await apiClient.getBooks({ status: 'read' });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].status).toBe('read');
    });

    it('filters by rating', async () => {
      const response = await apiClient.getBooks({ rating: 5 });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].rating).toBe(5);
    });

    it('searches by title (case-insensitive)', async () => {
      const response = await apiClient.getBooks({ title: 'reading' });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].title).toContain('Reading');
    });

    it('searches by author (case-insensitive)', async () => {
      await apiClient.createBook(TestDataBuilder.createBook({ author: 'Robert Martin' }));

      const response = await apiClient.getBooks({ author: 'martin' });

      expect(response.status).toBe(200);
      expect(response.body.books.length).toBeGreaterThan(0);
      expect(response.body.books[0].author).toMatch(/martin/i);
    });

    it('combines multiple filters', async () => {
      const response = await apiClient.getBooks({
        status: 'read',
        rating: 5,
      });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].status).toBe('read');
      expect(response.body.books[0].rating).toBe(5);
    });
  });

  describe('sorting', () => {
    beforeEach(async () => {
      await authHelper.getAuthenticatedClient();

      await apiClient.createBook(TestDataBuilder.createBook({ title: 'Zebra Book' }));
      await apiClient.createBook(TestDataBuilder.createBook({ title: 'Alpha Book' }));
      await apiClient.createBook(TestDataBuilder.createBook({ title: 'Beta Book' }));
    });

    it('sorts by title ascending', async () => {
      const response = await apiClient.getBooks({
        sortBy: 'title',
        sortOrder: 'ASC',
      });

      expect(response.status).toBe(200);
      expect(response.body.books[0].title).toBe('Alpha Book');
      expect(response.body.books[1].title).toBe('Beta Book');
      expect(response.body.books[2].title).toBe('Zebra Book');
    });

    it('sorts by title descending', async () => {
      const response = await apiClient.getBooks({
        sortBy: 'title',
        sortOrder: 'DESC',
      });

      expect(response.status).toBe(200);
      expect(response.body.books[0].title).toBe('Zebra Book');
      expect(response.body.books[1].title).toBe('Beta Book');
      expect(response.body.books[2].title).toBe('Alpha Book');
    });

    it('sorts by creation date by default (newest first)', async () => {
      const response = await apiClient.getBooks();

      expect(response.status).toBe(200);
      const dates = response.body.books.map((b: any) => new Date(b.createdAt).getTime());

      // newest first
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });
  });

  describe('authorization', () => {
    it('returns 401 without a token', async () => {
      const response = await apiClient.getBooks();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 401 with an invalid token', async () => {
      apiClient.setToken('invalid-token');

      const response = await apiClient.getBooks();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});
