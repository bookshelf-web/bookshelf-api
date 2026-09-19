import { BooksService } from '../../../src/contexts/library/books/booksService';
import { StatsService } from '../../../src/contexts/library/stats/statsService';
import { BookStatus } from '../../../src/contexts/library/types';

const qb = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const repository = {
  create: jest.fn((data: object) => data),
  save: jest.fn(async (book: object) => book),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => qb),
};

jest.mock('../../../src/config/database', () => ({
  AppDataSource: { getRepository: () => repository },
}));

const book = (overrides: object = {}) => ({ id: 'b1', userId: 'u1', title: 'T', author: 'A', status: BookStatus.TO_READ, ...overrides });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BooksService.create', () => {
  it('starts every book as to_read and ties it to the user', async () => {
    repository.findOne.mockResolvedValue(null);

    const created = await BooksService.create('u1', { title: 'T', author: 'A', isbn: '123' });

    expect(created).toMatchObject({ userId: 'u1', status: BookStatus.TO_READ, isbn: '123' });
  });

  it('rejects an ISBN that is already registered', async () => {
    repository.findOne.mockResolvedValue({ id: 'other' });

    await expect(BooksService.create('u1', { title: 'T', author: 'A', isbn: '123' })).rejects.toMatchObject({
      code: 'ISBN_ALREADY_REGISTERED',
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])('does not look up a blank ISBN (%p)', async isbn => {
    await BooksService.create('u1', { title: 'T', author: 'A', isbn });

    expect(repository.findOne).not.toHaveBeenCalled();
  });
});

describe('BooksService.list', () => {
  beforeEach(() => {
    qb.getManyAndCount.mockResolvedValue([[book()], 25]);
  });

  it('always scopes to the user and paginates', async () => {
    const result = await BooksService.list('u1', { page: 3, limit: 10 });

    expect(qb.where).toHaveBeenCalledWith('book.userId = :userId', { userId: 'u1' });
    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(result.pagination).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3 });
  });

  it('defaults to newest first', async () => {
    await BooksService.list('u1', { page: 1, limit: 10 });

    expect(qb.orderBy).toHaveBeenCalledWith('book.createdAt', 'DESC');
  });

  it('honours a whitelisted sort column and order', async () => {
    await BooksService.list('u1', { page: 1, limit: 10, sortBy: 'title', sortOrder: 'DESC' });

    expect(qb.orderBy).toHaveBeenCalledWith('book.title', 'DESC');
  });

  it('adds one condition per active filter, wrapping searches in wildcards', async () => {
    await BooksService.list('u1', {
      page: 1,
      limit: 10,
      status: BookStatus.READ,
      rating: 4,
      search: 'dom',
      title: 'ca',
      author: 'mach',
    });

    const sql = qb.andWhere.mock.calls.map(call => call[0] as string);
    expect(sql).toHaveLength(5);
    expect(qb.andWhere).toHaveBeenCalledWith('book.status = :status', { status: BookStatus.READ });
    expect(qb.andWhere).toHaveBeenCalledWith('book.rating = :rating', { rating: 4 });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('LOWER(book.title)'), { search: '%dom%' });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining(':title'), { title: '%ca%' });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining(':author'), { author: '%mach%' });
  });

  it('adds no extra conditions without filters', async () => {
    await BooksService.list('u1', { page: 1, limit: 10 });

    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});

describe('BooksService.getById / remove', () => {
  it('scopes the lookup to the user and answers 404 otherwise', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(BooksService.getById('u1', 'b1')).rejects.toMatchObject({ code: 'BOOK_NOT_FOUND' });
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'b1', userId: 'u1' } });
  });

  it('removes an owned book', async () => {
    const found = book();
    repository.findOne.mockResolvedValue(found);

    await BooksService.remove('u1', 'b1');

    expect(repository.remove).toHaveBeenCalledWith(found);
  });
});

describe('BooksService.update', () => {
  it('changes only what was sent', async () => {
    repository.findOne.mockResolvedValue(book({ publisher: 'Old', pages: 100 }));

    const updated = await BooksService.update('u1', 'b1', { title: 'New' });

    expect(updated).toMatchObject({ title: 'New', publisher: 'Old', pages: 100 });
  });

  it('clears optional fields with null (undefined would be ignored by TypeORM)', async () => {
    repository.findOne.mockResolvedValue(
      book({ rating: 4, notes: 'n', publisher: 'p', pages: 9, description: 'd', language: 'pt', coverUrl: 'u', isbn: '1' }),
    );

    const updated = await BooksService.update('u1', 'b1', {
      rating: null,
      notes: null,
      publisher: null,
      pages: null,
      description: null,
      language: null,
      coverUrl: null,
      isbn: null,
      publishedYear: null,
    });

    for (const field of ['rating', 'notes', 'publisher', 'pages', 'description', 'language', 'coverUrl', 'isbn', 'publishedYear']) {
      expect((updated as unknown as Record<string, unknown>)[field]).toBeNull();
    }
  });

  it('turns blank text into null and trims the rest', async () => {
    repository.findOne.mockResolvedValue(book());

    const updated = await BooksService.update('u1', 'b1', { publisher: '  Acme ', description: '   ' });

    expect(updated).toMatchObject({ publisher: 'Acme', description: null });
  });

  it('checks ISBN availability only when it changes', async () => {
    repository.findOne.mockResolvedValueOnce(book({ isbn: '111' }));
    await BooksService.update('u1', 'b1', { isbn: ' 111 ' });
    expect(repository.findOne).toHaveBeenCalledTimes(1);

    repository.findOne.mockReset();
    repository.findOne.mockResolvedValueOnce({ id: 'other' }).mockResolvedValueOnce(book({ isbn: '111' }));
    await expect(BooksService.update('u1', 'b1', { isbn: '222' })).rejects.toMatchObject({
      code: 'ISBN_ALREADY_REGISTERED',
    });
  });
});

describe('BooksService.updateStatus', () => {
  it('stamps startedAt once when reading starts', async () => {
    const found = book();
    repository.findOne.mockResolvedValue(found);

    const updated = await BooksService.updateStatus('u1', 'b1', BookStatus.READING);

    expect(updated.status).toBe(BookStatus.READING);
    expect(updated.startedAt).toBeInstanceOf(Date);
    expect(updated.finishedAt).toBeUndefined();
  });

  it('stamps finishedAt when finished and keeps existing timestamps', async () => {
    const started = new Date('2026-01-01');
    repository.findOne.mockResolvedValue(book({ startedAt: started }));

    const updated = await BooksService.updateStatus('u1', 'b1', BookStatus.READ);

    expect(updated.startedAt).toBe(started);
    expect(updated.finishedAt).toBeInstanceOf(Date);
  });

  it('does not overwrite an existing finish date', async () => {
    const finished = new Date('2026-02-02');
    repository.findOne.mockResolvedValue(book({ finishedAt: finished }));

    const updated = await BooksService.updateStatus('u1', 'b1', BookStatus.READ);

    expect(updated.finishedAt).toBe(finished);
  });
});

describe('StatsService.overview', () => {
  it('counts books by status and sums pages and ratings', async () => {
    repository.find.mockResolvedValue([
      { status: BookStatus.TO_READ, rating: null, pages: 100 },
      { status: BookStatus.READING, rating: 3, pages: null },
      { status: BookStatus.READ, rating: 5, pages: 200 },
      { status: BookStatus.READ, rating: 4, pages: 50 },
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
