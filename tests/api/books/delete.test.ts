import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

describe('DELETE /api/books/:id', () => {
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
    it('deletes an existing book', async () => {
      const response = await apiClient.deleteBook(bookId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Book deleted successfully');
    });

    it('a deleted book no longer exists', async () => {
      // delete the book
      await apiClient.deleteBook(bookId);

      // try to fetch the deleted book
      const getResponse = await apiClient.getBookById(bookId);

      expect(getResponse.status).toBe(404);
      expect(getResponse.body).toHaveProperty('error');
    });

    it('a deleted book no longer appears in the list', async () => {
      // add more books
      await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.createBook(TestDataBuilder.createBook());

      // expect 3 books
      let listResponse = await apiClient.getBooks();
      expect(listResponse.body.books).toHaveLength(3);

      // delete one book
      await apiClient.deleteBook(bookId);

      // expect only 2 now
      listResponse = await apiClient.getBooks();
      expect(listResponse.body.books).toHaveLength(2);

      // the deleted book is gone
      const deletedBookStillExists = listResponse.body.books.some((b: any) => b.id === bookId);
      expect(deletedBookStillExists).toBe(false);
    });

    it('deletes multiple books', async () => {
      const book2 = await apiClient.createBook(TestDataBuilder.createBook());
      const book3 = await apiClient.createBook(TestDataBuilder.createBook());

      // delete all of them
      await apiClient.deleteBook(bookId);
      await apiClient.deleteBook(book2.body.book.id);
      await apiClient.deleteBook(book3.body.book.id);

      // the list is empty
      const listResponse = await apiClient.getBooks();
      expect(listResponse.body.books).toHaveLength(0);
    });
  });

  describe('error cases', () => {
    it('returns 404 when the book does not exist', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await apiClient.deleteBook(fakeId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/not found/i);
    });

    it('returns 404 when deleting an already-deleted book', async () => {
      // delete the book
      await apiClient.deleteBook(bookId);

      // delete again
      const response = await apiClient.deleteBook(bookId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 404 when deleting a book owned by another user', async () => {
      // user 2 tries to delete user 1's book
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());

      const response = await client2.deleteBook(bookId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('user isolation', () => {
    it('deleting one user’s book does not affect another user’s books', async () => {
      // user 2 creates books
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
      await client2.createBook(TestDataBuilder.createBook());
      await client2.createBook(TestDataBuilder.createBook());

      // user 1 deletes their book
      await apiClient.deleteBook(bookId);

      // user 2 still has 2 books
      const user2Books = await client2.getBooks();
      expect(user2Books.body.books).toHaveLength(2);
    });
  });

  describe('authorization', () => {
    it('returns 401 without a token', async () => {
      apiClient.clearToken();

      const response = await apiClient.deleteBook(bookId);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 401 with an invalid token', async () => {
      apiClient.setToken('invalid-token');

      const response = await apiClient.deleteBook(bookId);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('data persistence', () => {
    it('the ISBN can be reused after the book is deleted', async () => {
      const bookData = await apiClient.getBookById(bookId);
      const isbn = bookData.body.book.isbn;

      // delete the book
      await apiClient.deleteBook(bookId);

      // create a new book with the same ISBN
      const newBook = TestDataBuilder.createBook({ isbn });
      const response = await apiClient.createBook(newBook);

      expect(response.status).toBe(201);
      expect(response.body.book.isbn).toBe(isbn);
    });
  });
});
