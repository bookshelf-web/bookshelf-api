import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

describe('GET /api/stats', () => {
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

  describe('success', () => {
    it('returns empty stats when the user has no books', async () => {
      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toEqual({
        total: 0,
        byStatus: {
          toRead: 0,
          reading: 0,
          read: 0,
        },
        averageRating: 0,
        totalPages: 0,
        booksWithRating: 0,
      });
    });

    it('counts the total number of books', async () => {
      await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.createBook(TestDataBuilder.createBook());

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.total).toBe(3);
    });

    it('counts books by status', async () => {
      // books with different statuses
      await apiClient.createBook(TestDataBuilder.createBook());

      const book2 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBookStatus(book2.body.book.id, 'reading');

      const book3 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBookStatus(book3.body.book.id, 'reading');

      const book4 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBookStatus(book4.body.book.id, 'read');

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.byStatus).toEqual({
        toRead: 1,
        reading: 2,
        read: 1,
      });
    });

    it('computes the average rating', async () => {
      // books with ratings
      const book1 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBook(book1.body.book.id, { rating: 5 });

      const book2 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBook(book2.body.book.id, { rating: 4 });

      const book3 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBook(book3.body.book.id, { rating: 3 });

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.averageRating).toBe(4); // (5+4+3)/3 = 4
      expect(response.body.stats.booksWithRating).toBe(3);
    });

    it('ignores books without a rating in the average', async () => {
      // books with a rating
      const book1 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBook(book1.body.book.id, { rating: 5 });

      const book2 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBook(book2.body.book.id, { rating: 3 });

      // books without a rating
      await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.createBook(TestDataBuilder.createBook());

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.averageRating).toBe(4); // (5+3)/2 = 4
      expect(response.body.stats.booksWithRating).toBe(2);
      expect(response.body.stats.total).toBe(4);
    });

    it('sums the total number of pages', async () => {
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 300 }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 450 }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 250 }));

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.totalPages).toBe(1000);
    });

    it('ignores books without pages in the total', async () => {
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 300 }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: undefined }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 200 }));

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.totalPages).toBe(500);
    });
  });

  it('returns only stats for the authenticated user', async () => {
    await cleanupTestDatabase();

    // Independent clients: AuthHelper mutates the token on the client it wraps.
    const client1 = new ApiClient();
    await new AuthHelper(client1).getAuthenticatedClient();
    await client1.createBook(TestDataBuilder.createBook());
    await client1.createBook(TestDataBuilder.createBook());
    await client1.createBook(TestDataBuilder.createBook());

    const client2 = new ApiClient();
    await new AuthHelper(client2).getAuthenticatedClient(TestDataBuilder.createUser());
    await client2.createBook(TestDataBuilder.createBook());
    await client2.createBook(TestDataBuilder.createBook());
    await client2.createBook(TestDataBuilder.createBook());
    await client2.createBook(TestDataBuilder.createBook());
    await client2.createBook(TestDataBuilder.createBook());

    expect((await client1.getStats()).body.stats.total).toBe(3);
    expect((await client2.getStats()).body.stats.total).toBe(5);
  });

  describe('complex scenarios', () => {
    it('computes the full statistics', async () => {
      // build a full library
      const book1 = await apiClient.createBook(TestDataBuilder.createBook({ pages: 400 }));
      await apiClient.updateBook(book1.body.book.id, { rating: 5 });
      await apiClient.updateBookStatus(book1.body.book.id, 'read');

      const book2 = await apiClient.createBook(TestDataBuilder.createBook({ pages: 300 }));
      await apiClient.updateBook(book2.body.book.id, { rating: 4 });
      await apiClient.updateBookStatus(book2.body.book.id, 'read');

      const book3 = await apiClient.createBook(TestDataBuilder.createBook({ pages: 250 }));
      await apiClient.updateBookStatus(book3.body.book.id, 'reading');

      await apiClient.createBook(TestDataBuilder.createBook({ pages: 500 }));

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats).toEqual({
        total: 4,
        byStatus: {
          toRead: 1,
          reading: 1,
          read: 2,
        },
        averageRating: 4.5, // (5+4)/2
        totalPages: 1450,
        booksWithRating: 2,
      });
    });

    it('recomputes statistics after a book is deleted', async () => {
      const book1 = await apiClient.createBook(TestDataBuilder.createBook({ pages: 300 }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 200 }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 100 }));

      // initial stats
      let stats = await apiClient.getStats();
      expect(stats.body.stats.total).toBe(3);
      expect(stats.body.stats.totalPages).toBe(600);

      // delete one book
      await apiClient.deleteBook(book1.body.book.id);

      // updated stats
      stats = await apiClient.getStats();
      expect(stats.body.stats.total).toBe(2);
      expect(stats.body.stats.totalPages).toBe(300);
    });
  });

  describe('authorization', () => {
    it('returns 401 without a token', async () => {
      apiClient.clearToken();

      const response = await apiClient.getStats();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 401 with an invalid token', async () => {
      apiClient.setToken('invalid-token');

      const response = await apiClient.getStats();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});
