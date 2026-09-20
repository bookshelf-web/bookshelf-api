import { BooksService } from '../../../src/contexts/library/books/booksService';
import { StatsService } from '../../../src/contexts/library/stats/statsService';
import { BookStatus } from '../../../src/contexts/library/types';
import { CatalogBookStatus, CatalogReviewStatus, CatalogService } from '../../../src/contexts/catalog';

const qb = {
  innerJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const repository = {
  create: jest.fn((data: object) => data),
  save: jest.fn(async (book: object): Promise<object> => ({ id: 'b1', createdAt: new Date(), updatedAt: new Date(), ...book })),
  findOne: jest.fn(),
  find: jest.fn(),
  exists: jest.fn(),
  count: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => qb),
};

jest.mock('../../../src/config/database', () => ({
  AppDataSource: { getRepository: () => repository },
}));
jest.mock('../../../src/contexts/catalog', () => ({
  ...jest.requireActual('../../../src/contexts/catalog/models/CatalogBook'),
  EDITABLE_FIELDS: [
    'title', 'author', 'isbn', 'publisher', 'publishedYear', 'edition', 'pages', 'language', 'description', 'coverUrl',
  ],
  CatalogService: {
    findOrCreate: jest.fn(),
    submitEdit: jest.fn(),
    pendingRevisionsBy: jest.fn(),
  },
}));

const catalogService = jest.mocked(CatalogService);

const catalogBook = (overrides: object = {}) => ({
  id: 'c1',
  title: 'T',
  author: 'A',
  isbn: null,
  publisher: null,
  publishedYear: null,
  edition: null,
  pages: 100,
  language: null,
  description: null,
  coverUrl: null,
  status: CatalogBookStatus.ACTIVE,
  reviewStatus: CatalogReviewStatus.PENDING_REVIEW,
  createdBy: 'u1',
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

const entry = (overrides: object = {}) => ({
  id: 'b1',
  userId: 'u1',
  catalogBookId: 'c1',
  catalogBook: catalogBook(),
  status: BookStatus.TO_READ,
  rating: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  catalogService.pendingRevisionsBy.mockResolvedValue(new Map());
  repository.save.mockImplementation(async (book: object) => ({ ...book }) as object);
});

describe('BooksService.create', () => {
  beforeEach(() => {
    catalogService.findOrCreate.mockResolvedValue({ book: catalogBook() as never, created: true });
    repository.exists.mockResolvedValue(false);
  });

  it('registers (or finds) the catalog book and shelves it as to_read', async () => {
    const view = await BooksService.create('u1', { title: 'T', author: 'A', isbn: '9780132350884', rating: 4, notes: 'n' });

    expect(catalogService.findOrCreate).toHaveBeenCalledWith('u1', { title: 'T', author: 'A', isbn: '9780132350884' });
    expect(view).toMatchObject({ userId: 'u1', catalogBookId: 'c1', status: BookStatus.TO_READ, rating: 4, notes: 'n' });
    expect(view.title).toBe('T');
    expect(view.catalog).toEqual({ status: 'active', reviewStatus: 'pending_review' });
  });

  it('keeps personal data out of the catalog', async () => {
    await BooksService.create('u1', { title: 'T', author: 'A', rating: 5, notes: 'mine' });

    const [, metadata] = catalogService.findOrCreate.mock.calls[0];
    expect(metadata).not.toHaveProperty('rating');
    expect(metadata).not.toHaveProperty('notes');
  });

  it('rejects a book the reader already shelved, with an ISBN-specific code when there is one', async () => {
    repository.exists.mockResolvedValue(true);

    await expect(BooksService.create('u1', { title: 'T', author: 'A', isbn: '9780132350884' })).rejects.toMatchObject({
      code: 'ISBN_ALREADY_REGISTERED',
      statusCode: 409,
    });
    await expect(BooksService.create('u1', { title: 'T', author: 'A' })).rejects.toMatchObject({
      code: 'BOOK_ALREADY_IN_LIBRARY',
    });
    expect(repository.save).not.toHaveBeenCalled();
  });
});

describe('BooksService.list', () => {
  beforeEach(() => {
    qb.getManyAndCount.mockResolvedValue([[entry()], 25]);
  });

  it('scopes to the user, joins the catalog and paginates', async () => {
    const result = await BooksService.list('u1', { page: 3, limit: 10 });

    expect(qb.innerJoinAndSelect).toHaveBeenCalledWith('book.catalogBook', 'catalog');
    expect(qb.where).toHaveBeenCalledWith('book.userId = :userId', { userId: 'u1' });
    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(result.pagination).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3 });
    expect(result.books[0]).toMatchObject({ id: 'b1', title: 'T', pages: 100 });
  });

  it('defaults to newest first', async () => {
    await BooksService.list('u1', { page: 1, limit: 10 });

    expect(qb.orderBy).toHaveBeenCalledWith('book.createdAt', 'DESC');
  });

  it.each([
    ['title', 'catalog.title'],
    ['author', 'catalog.author'],
    ['pages', 'catalog.pages'],
    ['publishedYear', 'catalog.publishedYear'],
    ['status', 'book.status'],
    ['rating', 'book.rating'],
  ] as const)('sorts by %s on %s', async (sortBy, column) => {
    await BooksService.list('u1', { page: 1, limit: 10, sortBy, sortOrder: 'DESC' });

    expect(qb.orderBy).toHaveBeenCalledWith(column, 'DESC');
  });

  it('filters personal fields on the entry and descriptive fields on the catalog', async () => {
    await BooksService.list('u1', {
      page: 1,
      limit: 10,
      status: BookStatus.READ,
      rating: 4,
      search: 'dom',
      title: 'ca',
      author: 'mach',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('book.status = :status', { status: BookStatus.READ });
    expect(qb.andWhere).toHaveBeenCalledWith('book.rating = :rating', { rating: 4 });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('LOWER(catalog.title)'), { search: '%dom%' });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('catalog.title) LIKE LOWER(:title'), { title: '%ca%' });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('catalog.author) LIKE LOWER(:author'), {
      author: '%mach%',
    });
  });

  it('attaches the reader\'s pending proposal to the matching book', async () => {
    catalogService.pendingRevisionsBy.mockResolvedValue(
      new Map([['c1', { id: 'r1', changes: { title: { from: 'T', to: 'New' } } } as never]]),
    );

    const { books } = await BooksService.list('u1', { page: 1, limit: 10 });

    expect(books[0].pendingRevision).toEqual({ id: 'r1', changes: { title: { from: 'T', to: 'New' } } });
  });
});

describe('BooksService.getById / remove', () => {
  it('scopes the lookup to the user and answers 404 otherwise', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(BooksService.getById('u1', 'b1')).rejects.toMatchObject({ code: 'BOOK_NOT_FOUND' });
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'b1', userId: 'u1' }, relations: { catalogBook: true } });
  });

  it('removes only the shelf entry, never the catalog book', async () => {
    const found = entry();
    repository.findOne.mockResolvedValue(found);

    await BooksService.remove('u1', 'b1');

    expect(repository.remove).toHaveBeenCalledWith(found);
  });
});

describe('BooksService.update', () => {
  const outcome = (overrides: object = {}) => ({ mode: 'applied', book: catalogBook({ title: 'New' }), ...overrides });

  it('applies personal fields at once without touching the catalog', async () => {
    repository.findOne.mockResolvedValue(entry());

    const view = await BooksService.update('u1', 'b1', { rating: 5, notes: 'great', status: BookStatus.READING });

    expect(catalogService.submitEdit).not.toHaveBeenCalled();
    expect(view).toMatchObject({ rating: 5, notes: 'great', status: BookStatus.READING });
  });

  it('clears personal fields with null (undefined would be ignored by TypeORM)', async () => {
    repository.findOne.mockResolvedValue(entry({ rating: 4, notes: 'n' }));

    const view = await BooksService.update('u1', 'b1', { rating: null, notes: null });

    expect(view.rating).toBeNull();
    expect(view.notes).toBeNull();
  });

  it('lets the creator fix a fresh registration directly while nobody else shelves it', async () => {
    repository.findOne.mockResolvedValue(entry());
    repository.count.mockResolvedValue(0);
    catalogService.submitEdit.mockResolvedValue(outcome() as never);

    const view = await BooksService.update('u1', 'b1', { title: ' New ' });

    expect(catalogService.submitEdit).toHaveBeenCalledWith({
      actorId: 'u1',
      catalogBookId: 'c1',
      changes: { title: 'New' },
      canEditDirectly: true,
    });
    expect(view.title).toBe('New');
    expect(view.pendingRevision).toBeNull();
  });

  it.each([
    ['someone else also shelves it', { count: 1, review: CatalogReviewStatus.PENDING_REVIEW, createdBy: 'u1' }],
    ['an admin already reviewed it', { count: 0, review: CatalogReviewStatus.REVIEWED, createdBy: 'u1' }],
    ['the reader is not its creator', { count: 0, review: CatalogReviewStatus.PENDING_REVIEW, createdBy: 'other' }],
  ])('sends the edit for approval when %s', async (_label, { count, review, createdBy }) => {
    repository.findOne.mockResolvedValue(entry({ catalogBook: catalogBook({ reviewStatus: review, createdBy }) }));
    repository.count.mockResolvedValue(count);
    catalogService.submitEdit.mockResolvedValue(
      outcome({ mode: 'proposed', book: catalogBook(), revision: { id: 'r1', changes: { title: { from: 'T', to: 'X' } } } }) as never,
    );

    const view = await BooksService.update('u1', 'b1', { title: 'X' });

    expect(catalogService.submitEdit).toHaveBeenCalledWith(expect.objectContaining({ canEditDirectly: false }));
    expect(view.title).toBe('T');
    expect(view.pendingRevision).toMatchObject({ id: 'r1' });
  });

  it('applies personal changes even when the descriptive ones await approval', async () => {
    repository.findOne.mockResolvedValue(entry({ catalogBook: catalogBook({ reviewStatus: CatalogReviewStatus.REVIEWED }) }));
    repository.count.mockResolvedValue(0);
    catalogService.submitEdit.mockResolvedValue(outcome({ mode: 'proposed', book: catalogBook(), revision: { id: 'r1', changes: {} } }) as never);

    const view = await BooksService.update('u1', 'b1', { title: 'X', rating: 3 });

    expect(view.rating).toBe(3);
    expect(view.title).toBe('T');
  });

  it('only sends the descriptive fields that were provided', async () => {
    repository.findOne.mockResolvedValue(entry());
    repository.count.mockResolvedValue(0);
    catalogService.submitEdit.mockResolvedValue(outcome() as never);

    await BooksService.update('u1', 'b1', { pages: 300, isbn: null });

    expect(catalogService.submitEdit).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { pages: 300, isbn: null } }),
    );
  });

  it('answers 404 for a book the reader does not have', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(BooksService.update('u1', 'nope', { rating: 3 })).rejects.toMatchObject({ code: 'BOOK_NOT_FOUND' });
  });
});

describe('BooksService.updateStatus', () => {
  it('stamps startedAt once when reading starts', async () => {
    repository.findOne.mockResolvedValue(entry());

    const view = await BooksService.updateStatus('u1', 'b1', BookStatus.READING);

    expect(view.status).toBe(BookStatus.READING);
    expect(view.startedAt).toBeInstanceOf(Date);
    expect(view.finishedAt).toBeUndefined();
  });

  it('stamps finishedAt when finished and keeps existing timestamps', async () => {
    const started = new Date('2026-01-01');
    repository.findOne.mockResolvedValue(entry({ startedAt: started }));

    const view = await BooksService.updateStatus('u1', 'b1', BookStatus.READ);

    expect(view.startedAt).toBe(started);
    expect(view.finishedAt).toBeInstanceOf(Date);
  });

  it('does not overwrite an existing finish date', async () => {
    const finished = new Date('2026-02-02');
    repository.findOne.mockResolvedValue(entry({ finishedAt: finished }));

    const view = await BooksService.updateStatus('u1', 'b1', BookStatus.READ);

    expect(view.finishedAt).toBe(finished);
  });
});

describe('StatsService.overview', () => {
  const shelved = (status: BookStatus, rating: number | null, pages: number | null) =>
    entry({ status, rating, catalogBook: catalogBook({ pages }) });

  it('counts books by status and sums catalog pages and ratings', async () => {
    repository.find.mockResolvedValue([
      shelved(BookStatus.TO_READ, null, 100),
      shelved(BookStatus.READING, 3, null),
      shelved(BookStatus.READ, 5, 200),
      shelved(BookStatus.READ, 4, 50),
    ]);

    expect(await StatsService.overview('u1')).toEqual({
      total: 4,
      byStatus: { toRead: 1, reading: 1, read: 2 },
      averageRating: 4,
      totalPages: 350,
      booksWithRating: 3,
    });
  });

  it('is all zeros for an empty library', async () => {
    repository.find.mockResolvedValue([]);

    expect(await StatsService.overview('u1')).toEqual({
      total: 0,
      byStatus: { toRead: 0, reading: 0, read: 0 },
      averageRating: 0,
      totalPages: 0,
      booksWithRating: 0,
    });
  });
});
