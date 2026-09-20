import { ApiClient } from '../../helpers/apiClient';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
} from '../../setup/testDatabase';

const ADMIN_EMAIL = 'admin@bookshelf.test';

async function signUp(overrides: Record<string, unknown> = {}) {
  const api = new ApiClient();
  const response = await api.register(TestDataBuilder.createUser(overrides));
  api.setToken(response.body.token);
  return { api, user: response.body.user };
}

const shelve = (api: ApiClient, overrides: Record<string, unknown> = {}) =>
  api.createBook(TestDataBuilder.createBook(overrides));

describe('shared catalog', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('a book exists once', () => {
    it('gives two readers the same catalog book when they add the same ISBN', async () => {
      const ana = await signUp();
      const bia = await signUp();
      const isbn = TestDataBuilder.generateUniqueISBN();

      const first = await shelve(ana.api, { isbn, title: 'Original Title' });
      const second = await shelve(bia.api, { isbn, title: 'Another Title' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.book.catalogBookId).toBe(first.body.book.catalogBookId);
      // The second reader sees the catalog's data, not what they typed.
      expect(second.body.book.title).toBe('Original Title');
      expect(second.body.book.id).not.toBe(first.body.book.id);
    });

    it('matches the same book written as ISBN-10 or with hyphens', async () => {
      const ana = await signUp();
      const bia = await signUp();

      const first = await shelve(ana.api, { isbn: '9780132350884' });
      const second = await shelve(bia.api, { isbn: '0-13-235088-2' });

      expect(second.body.book.catalogBookId).toBe(first.body.book.catalogBookId);
      expect(second.body.book.isbn).toBe('9780132350884');
    });

    it('refuses the same book twice on one shelf', async () => {
      const ana = await signUp();
      const isbn = TestDataBuilder.generateUniqueISBN();
      await shelve(ana.api, { isbn });

      const again = await shelve(ana.api, { isbn });

      expect(again.status).toBe(409);
      expect(again.body.code).toBe('ISBN_ALREADY_REGISTERED');
    });

    it('merges books without an ISBN that share title, author, publisher, year and edition', async () => {
      const ana = await signUp();
      const bia = await signUp();
      const fields = { isbn: undefined, title: 'Sagarana', author: 'Guimarães Rosa', publisher: 'Nova Fronteira', publishedYear: 1946 };

      const first = await shelve(ana.api, { ...fields, edition: '1ª' });
      const sameEdition = await shelve(bia.api, { ...fields, title: 'SAGARANA', edition: '1a' });
      const otherEdition = await shelve(bia.api, { ...fields, edition: '2ª' });

      expect(sameEdition.body.book.catalogBookId).toBe(first.body.book.catalogBookId);
      expect(otherEdition.body.book.catalogBookId).not.toBe(first.body.book.catalogBookId);
    });

    it('keeps the catalog book when a reader removes it from their shelf', async () => {
      const ana = await signUp();
      const bia = await signUp();
      const isbn = TestDataBuilder.generateUniqueISBN();
      const first = await shelve(ana.api, { isbn });
      await shelve(bia.api, { isbn });

      await ana.api.deleteBook(first.body.book.id);

      const stillThere = await bia.api.call('get', `/catalog/books/${first.body.book.catalogBookId}`);
      expect(stillThere.status).toBe(200);
    });

    it('lists and sorts the shelf using the catalog data', async () => {
      const ana = await signUp();
      await shelve(ana.api, { title: 'B book' });
      await shelve(ana.api, { title: 'A book' });

      const byTitle = await ana.api.getBooks({ sortBy: 'title', sortOrder: 'ASC' });
      const search = await ana.api.getBooks({ search: 'a book' });

      expect(byTitle.body.books.map((b: { title: string }) => b.title)).toEqual(['A book', 'B book']);
      expect(search.body.books).toHaveLength(1);
    });
  });

  describe('first registration', () => {
    it('is usable at once and waits for an admin to review it', async () => {
      const ana = await signUp();

      const created = await shelve(ana.api);

      expect(created.body.book.catalog).toEqual({ status: 'active', reviewStatus: 'pending_review' });
    });

    it('shows up in the admin review queue until confirmed', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const ana = await signUp();
      const created = await shelve(ana.api);
      const id = created.body.book.catalogBookId;

      const queue = await admin.api.call('get', '/admin/catalog/books?review=pending_review');
      expect(queue.body.books.map((b: { id: string }) => b.id)).toContain(id);

      const confirmed = await admin.api.call('post', `/admin/catalog/books/${id}/review`);
      expect(confirmed.status).toBe(200);
      expect(confirmed.body.book.reviewStatus).toBe('reviewed');

      const after = await admin.api.call('get', '/admin/catalog/books?review=pending_review');
      expect(after.body.books.map((b: { id: string }) => b.id)).not.toContain(id);
    });

    it('can search the review queue by title, author or ISBN', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const ana = await signUp();
      const isbn = TestDataBuilder.generateUniqueISBN();
      await shelve(ana.api, { isbn, title: 'Needle In Queue' });
      await shelve(ana.api, { title: 'Something Else' });

      const byTitle = await admin.api.call('get', '/admin/catalog/books?review=pending_review&search=needle');
      const byIsbn = await admin.api.call('get', `/admin/catalog/books?review=pending_review&search=${isbn}`);

      expect(byTitle.body.books).toHaveLength(1);
      expect(byIsbn.body.books[0].title).toBe('Needle In Queue');
    });

    it('rejects an invalid ISBN', async () => {
      const ana = await signUp();

      const response = await shelve(ana.api, { isbn: '9781234567890' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_ISBN');
    });
  });

  describe('editing', () => {
    it('lets the creator fix a fresh registration directly while nobody else shelves it', async () => {
      const ana = await signUp();
      const created = await shelve(ana.api, { title: 'Typo Title' });

      const response = await ana.api.updateBook(created.body.book.id, { title: 'Correct Title' });

      expect(response.status).toBe(200);
      expect(response.body.book.title).toBe('Correct Title');
      expect(response.body.book.pendingRevision).toBeNull();
    });

    it('turns the edit into a proposal once another reader shelves the book', async () => {
      const ana = await signUp();
      const bia = await signUp();
      const isbn = TestDataBuilder.generateUniqueISBN();
      const created = await shelve(ana.api, { isbn, title: 'Shared Title' });
      await shelve(bia.api, { isbn });

      const response = await ana.api.updateBook(created.body.book.id, { title: 'Renamed' });

      expect(response.status).toBe(200);
      expect(response.body.book.title).toBe('Shared Title');
      expect(response.body.book.pendingRevision.changes.title).toEqual({ from: 'Shared Title', to: 'Renamed' });
    });

    it('turns every edit into a proposal after an admin reviewed the book, even the creator\'s', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const ana = await signUp();
      const created = await shelve(ana.api, { title: 'Reviewed Title' });
      await admin.api.call('post', `/admin/catalog/books/${created.body.book.catalogBookId}/review`);

      const response = await ana.api.updateBook(created.body.book.id, { title: 'Sneaky Change' });

      expect(response.body.book.title).toBe('Reviewed Title');
      expect(response.body.book.pendingRevision).toBeTruthy();
    });

    it('still applies personal fields at once when the descriptive ones await approval', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const ana = await signUp();
      const created = await shelve(ana.api);
      await admin.api.call('post', `/admin/catalog/books/${created.body.book.catalogBookId}/review`);

      const response = await ana.api.updateBook(created.body.book.id, { title: 'Proposed', rating: 5, notes: 'loved it' });

      expect(response.body.book).toMatchObject({ rating: 5, notes: 'loved it' });
      expect(response.body.book.pendingRevision).toBeTruthy();
    });

    it('keeps one pending proposal per reader and book, replacing the earlier one', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const ana = await signUp();
      const created = await shelve(ana.api);
      await admin.api.call('post', `/admin/catalog/books/${created.body.book.catalogBookId}/review`);

      await ana.api.updateBook(created.body.book.id, { title: 'First try' });
      await ana.api.updateBook(created.body.book.id, { title: 'Second try' });

      const revisions = await admin.api.call('get', '/admin/catalog/revisions?status=pending');
      expect(revisions.body.revisions).toHaveLength(1);
      expect(revisions.body.revisions[0].changes.title.to).toBe('Second try');
    });

    it('does not create a proposal when nothing actually changes', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const ana = await signUp();
      const created = await shelve(ana.api, { title: 'Same' });
      await admin.api.call('post', `/admin/catalog/books/${created.body.book.catalogBookId}/review`);

      const response = await ana.api.updateBook(created.body.book.id, { title: 'Same' });

      expect(response.body.book.pendingRevision).toBeNull();
    });
  });

  describe('revisions', () => {
    async function proposeRename() {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const ana = await signUp();
      const bia = await signUp();
      const isbn = TestDataBuilder.generateUniqueISBN();
      const anaBook = await shelve(ana.api, { isbn, title: 'Old Title' });
      const biaBook = await shelve(bia.api, { isbn });
      const proposed = await ana.api.updateBook(anaBook.body.book.id, { title: 'New Title' });
      return { admin, ana, bia, anaBook, biaBook, revisionId: proposed.body.book.pendingRevision.id as string };
    }

    it('applies an approved proposal to the catalog, for every reader', async () => {
      const { admin, ana, bia, anaBook, biaBook, revisionId } = await proposeRename();

      const decision = await admin.api.call('post', `/admin/catalog/revisions/${revisionId}/decision`, {
        decision: 'approve',
        note: 'ok',
      });

      expect(decision.status).toBe(200);
      expect(decision.body.revision.status).toBe('approved');
      expect((await ana.api.getBookById(anaBook.body.book.id)).body.book.title).toBe('New Title');
      expect((await bia.api.getBookById(biaBook.body.book.id)).body.book.title).toBe('New Title');
      expect((await ana.api.getBookById(anaBook.body.book.id)).body.book.pendingRevision).toBeNull();
    });

    it('leaves the catalog untouched when a proposal is rejected', async () => {
      const { admin, ana, anaBook, revisionId } = await proposeRename();

      const decision = await admin.api.call('post', `/admin/catalog/revisions/${revisionId}/decision`, {
        decision: 'reject',
        note: 'not accurate',
      });

      expect(decision.body.revision).toMatchObject({ status: 'rejected', reviewNote: 'not accurate' });
      const book = (await ana.api.getBookById(anaBook.body.book.id)).body.book;
      expect(book.title).toBe('Old Title');
      expect(book.pendingRevision).toBeNull();
    });

    it('cannot be decided twice', async () => {
      const { admin, revisionId } = await proposeRename();
      await admin.api.call('post', `/admin/catalog/revisions/${revisionId}/decision`, { decision: 'approve' });

      const again = await admin.api.call('post', `/admin/catalog/revisions/${revisionId}/decision`, { decision: 'reject' });

      expect(again.status).toBe(409);
      expect(again.body.code).toBe('REVISION_ALREADY_DECIDED');
    });

    it('refuses to approve an edit that would duplicate another catalog book', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const ana = await signUp();
      const bia = await signUp();
      const takenIsbn = TestDataBuilder.generateUniqueISBN();
      await shelve(bia.api, { isbn: takenIsbn });
      const created = await shelve(ana.api, { isbn: TestDataBuilder.generateUniqueISBN() });
      await admin.api.call('post', `/admin/catalog/books/${created.body.book.catalogBookId}/review`);
      const proposed = await ana.api.updateBook(created.body.book.id, { isbn: takenIsbn });

      const decision = await admin.api.call(
        'post',
        `/admin/catalog/revisions/${proposed.body.book.pendingRevision.id}/decision`,
        { decision: 'approve' },
      );

      expect(decision.status).toBe(409);
      expect(decision.body.code).toBe('CATALOG_DUPLICATE');
    });

    it('lists proposals for the admin, with the book, and audits decisions', async () => {
      const { admin, revisionId } = await proposeRename();

      const pending = await admin.api.call('get', '/admin/catalog/revisions?status=pending');
      expect(pending.body.revisions[0]).toMatchObject({ id: revisionId, book: { title: 'Old Title' } });

      await admin.api.call('post', `/admin/catalog/revisions/${revisionId}/decision`, { decision: 'approve' });
      const audit = await admin.api.call('get', '/admin/audit-logs?targetType=catalog_book');
      expect(audit.body.entries[0].action).toBe('catalog.revision.approve');
    });

    it('answers 404 for an unknown revision', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });

      const response = await admin.api.call('post', '/admin/catalog/revisions/00000000-0000-4000-8000-000000000000/decision', {
        decision: 'approve',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('taking a book down', () => {
    it('hides it from the catalog and blocks new shelves, until restored', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const ana = await signUp();
      const bia = await signUp();
      const isbn = TestDataBuilder.generateUniqueISBN();
      const created = await shelve(ana.api, { isbn });
      const id = created.body.book.catalogBookId;

      const hidden = await admin.api.call('patch', `/admin/catalog/books/${id}/visibility`, { hidden: true, reason: 'nonsense' });
      expect(hidden.body.book.status).toBe('hidden');

      expect((await bia.api.call('get', `/catalog/books/${id}`)).status).toBe(404);
      const search = await bia.api.call('get', `/catalog/books?isbn=${isbn}`);
      expect(search.body.books).toHaveLength(0);
      const blocked = await shelve(bia.api, { isbn });
      expect(blocked.status).toBe(409);
      expect(blocked.body.code).toBe('CATALOG_BOOK_HIDDEN');
      // The reader who already had it keeps their entry.
      expect((await ana.api.getBookById(created.body.book.id)).status).toBe(200);

      await admin.api.call('patch', `/admin/catalog/books/${id}/visibility`, { hidden: false });
      expect((await shelve(bia.api, { isbn })).status).toBe(201);
    });
  });

  describe('admin edits and lookup', () => {
    it('lets an admin edit a catalog book directly, with an audit trail', async () => {
      const admin = await signUp({ email: ADMIN_EMAIL });
      const ana = await signUp();
      const created = await shelve(ana.api, { title: 'Wrong' });
      const id = created.body.book.catalogBookId;

      const edited = await admin.api.call('patch', `/admin/catalog/books/${id}`, { title: 'Right', pages: 321 });

      expect(edited.body.book).toMatchObject({ title: 'Right', pages: 321 });
      const audit = await admin.api.call('get', `/admin/audit-logs?targetType=catalog_book&targetId=${id}`);
      expect(audit.body.entries[0]).toMatchObject({ action: 'catalog.edit', changes: { title: { from: 'Wrong', to: 'Right' } } });
    });

    it('finds books by ISBN or text, for any signed-in user', async () => {
      const ana = await signUp();
      const bia = await signUp();
      const isbn = TestDataBuilder.generateUniqueISBN();
      await shelve(ana.api, { isbn, title: 'Findable Title' });

      const byIsbn = await bia.api.call('get', `/catalog/books?isbn=${isbn}`);
      const byText = await bia.api.call('get', '/catalog/books?search=findable');

      expect(byIsbn.body.books).toHaveLength(1);
      expect(byText.body.books).toHaveLength(1);
      expect((await new ApiClient().call('get', '/catalog/books')).status).toBe(401);
    });
  });

  describe('access', () => {
    it('keeps every moderation endpoint admin-only', async () => {
      const ana = await signUp();
      const created = await shelve(ana.api);
      const id = created.body.book.catalogBookId;
      const nil = '00000000-0000-4000-8000-000000000000';

      const attempts = [
        ana.api.call('get', '/admin/catalog/books'),
        ana.api.call('patch', `/admin/catalog/books/${id}`, { title: 'x' }),
        ana.api.call('post', `/admin/catalog/books/${id}/review`),
        ana.api.call('patch', `/admin/catalog/books/${id}/visibility`, { hidden: true }),
        ana.api.call('get', '/admin/catalog/revisions'),
        ana.api.call('post', `/admin/catalog/revisions/${nil}/decision`, { decision: 'approve' }),
      ];

      for (const response of await Promise.all(attempts)) expect(response.status).toBe(403);
    });
  });
});
