import { QueryFailedError } from 'typeorm';
import { CatalogService } from '../../../src/contexts/catalog/catalogService';
import { CatalogBook, CatalogBookStatus, CatalogReviewStatus } from '../../../src/contexts/catalog/models/CatalogBook';
import { CatalogRevision, RevisionStatus } from '../../../src/contexts/catalog/models/CatalogRevision';
import { AuditService } from '../../../src/contexts/audit';

const qb = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
  getMany: jest.fn(),
};

const books = {
  create: jest.fn((data: object) => ({ id: 'c-new', ...data })),
  save: jest.fn(async (row: object) => row),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(() => qb),
};
const revisions = {
  create: jest.fn((data: object) => ({ id: 'r-new', ...data })),
  save: jest.fn(async (row: object) => row),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  createQueryBuilder: jest.fn(() => qb),
};

jest.mock('../../../src/config/database', () => ({
  AppDataSource: { getRepository: (entity: unknown) => (entity === CatalogBook ? books : revisions) },
}));
jest.mock('../../../src/contexts/audit', () => ({ AuditService: { record: jest.fn() } }));

const uniqueViolation = () =>
  Object.assign(new QueryFailedError('insert', [], new Error('duplicate')), { code: '23505' });

const stored = (overrides: Partial<CatalogBook> = {}): CatalogBook =>
  ({
    id: 'c1',
    isbn: '9780132350884',
    dedupeKey: 'isbn:9780132350884',
    title: 'Clean Code',
    author: 'Robert Martin',
    publisher: null,
    publishedYear: null,
    edition: null,
    pages: null,
    language: null,
    description: null,
    coverUrl: null,
    status: CatalogBookStatus.ACTIVE,
    reviewStatus: CatalogReviewStatus.PENDING_REVIEW,
    createdBy: 'u1',
    ...overrides,
  }) as CatalogBook;

const revision = (overrides: Partial<CatalogRevision> = {}): CatalogRevision =>
  ({
    id: 'r1',
    catalogBookId: 'c1',
    proposedBy: 'u2',
    changes: { title: { from: 'Clean Code', to: 'Clean Code 2' } },
    status: RevisionStatus.PENDING,
    ...overrides,
  }) as CatalogRevision;

beforeEach(() => {
  jest.clearAllMocks();
  books.save.mockImplementation(async (row: object) => row);
  revisions.save.mockImplementation(async (row: object) => row);
});

describe('CatalogService.findOrCreate', () => {
  it('registers a new book keyed by its ISBN-13, usable now and flagged for review', async () => {
    books.findOne.mockResolvedValue(null);

    const { book, created } = await CatalogService.findOrCreate('u1', { title: 'Clean Code', author: 'Martin', isbn: '0-13-235088-2' });

    expect(created).toBe(true);
    expect(book).toMatchObject({
      isbn: '9780132350884',
      dedupeKey: 'isbn:9780132350884',
      status: CatalogBookStatus.ACTIVE,
      reviewStatus: CatalogReviewStatus.PENDING_REVIEW,
      createdBy: 'u1',
    });
  });

  it('reuses the existing book instead of creating another', async () => {
    books.findOne.mockResolvedValue(stored());

    const { book, created } = await CatalogService.findOrCreate('u2', { title: 'Other title', author: 'Someone', isbn: '9780132350884' });

    expect(created).toBe(false);
    expect(book.id).toBe('c1');
    expect(books.save).not.toHaveBeenCalled();
  });

  it('matches books without an ISBN by their descriptive fields', async () => {
    books.findOne.mockResolvedValue(null);

    await CatalogService.findOrCreate('u1', { title: 'Sagarana', author: 'Rosa', publisher: 'NF' });

    expect(books.findOne).toHaveBeenCalledWith({ where: { dedupeKey: expect.stringMatching(/^meta:sagarana\|rosa\|nf/) } });
    expect(books.create).toHaveBeenCalledWith(expect.objectContaining({ isbn: null }));
  });

  it('rejects an ISBN that is not valid, and treats a blank one as none', async () => {
    await expect(CatalogService.findOrCreate('u1', { title: 'T', author: 'A', isbn: '123' })).rejects.toMatchObject({
      code: 'INVALID_ISBN',
      statusCode: 400,
    });

    books.findOne.mockResolvedValue(null);
    const { book } = await CatalogService.findOrCreate('u1', { title: 'T', author: 'A', isbn: '  ' });
    expect(book.isbn).toBeNull();
  });

  it('refuses a book an admin took down', async () => {
    books.findOne.mockResolvedValue(stored({ status: CatalogBookStatus.HIDDEN }));

    await expect(CatalogService.findOrCreate('u2', { title: 'T', author: 'A', isbn: '9780132350884' })).rejects.toMatchObject({
      code: 'CATALOG_BOOK_HIDDEN',
      statusCode: 409,
    });
  });

  it('survives two people registering the same new book at once', async () => {
    books.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(stored());
    books.save.mockRejectedValueOnce(uniqueViolation());

    const { book, created } = await CatalogService.findOrCreate('u2', { title: 'T', author: 'A', isbn: '9780132350884' });

    expect(created).toBe(false);
    expect(book.id).toBe('c1');
  });

  it('does not swallow other database errors', async () => {
    books.findOne.mockResolvedValue(null);
    books.save.mockRejectedValueOnce(new Error('connection lost'));

    await expect(CatalogService.findOrCreate('u1', { title: 'T', author: 'A' })).rejects.toThrow('connection lost');
  });
});

describe('CatalogService reads', () => {
  it('answers 404 for an unknown book', async () => {
    books.findOne.mockResolvedValue(null);

    await expect(CatalogService.getById('nope')).rejects.toMatchObject({ code: 'CATALOG_BOOK_NOT_FOUND' });
  });

  it('maps ids to books and skips the query for an empty list', async () => {
    qb.getMany.mockResolvedValue([stored()]);

    expect((await CatalogService.findByIds(['c1'])).get('c1')?.title).toBe('Clean Code');
    expect((await CatalogService.findByIds([])).size).toBe(0);
    expect(books.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('searches active books, normalising the ISBN and matching text on title or author', async () => {
    qb.getManyAndCount.mockResolvedValue([[stored()], 21]);

    const result = await CatalogService.search({ isbn: '0132350882', search: 'clean', page: 2, limit: 10 });

    expect(qb.where).toHaveBeenCalledWith('book.status = :status', { status: CatalogBookStatus.ACTIVE });
    expect(qb.andWhere).toHaveBeenCalledWith('book.isbn = :isbn', { isbn: '9780132350884' });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('LOWER(book.title)'), { search: '%clean%' });
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
  });

  it('cannot match anything for an invalid ISBN', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);

    await CatalogService.search({ isbn: 'bogus', page: 1, limit: 10 });

    expect(qb.andWhere).toHaveBeenCalledWith('book.isbn = :isbn', { isbn: '' });
  });
});

describe('CatalogService.submitEdit', () => {
  const edit = (changes: object, canEditDirectly: boolean) =>
    CatalogService.submitEdit({ actorId: 'u2', catalogBookId: 'c1', changes, canEditDirectly });

  beforeEach(() => {
    books.findOne.mockResolvedValue(stored());
  });

  it('does nothing when the edit changes nothing', async () => {
    const outcome = await edit({ title: 'Clean Code', publisher: '', pages: undefined }, false);

    expect(outcome.mode).toBe('unchanged');
    expect(books.save).not.toHaveBeenCalled();
    expect(revisions.save).not.toHaveBeenCalled();
  });

  it('applies the edit directly when allowed, recomputing the dedupe key', async () => {
    const outcome = await edit({ title: 'Clean Code, 2nd ed', isbn: '0-13-235088-2' }, true);

    expect(outcome.mode).toBe('applied');
    expect(outcome.book.title).toBe('Clean Code, 2nd ed');
    expect(outcome.book.dedupeKey).toBe('isbn:9780132350884');
    expect(revisions.save).not.toHaveBeenCalled();
  });

  it('turns everyone else\'s edit into a proposal and leaves the book untouched', async () => {
    revisions.findOne.mockResolvedValue(null);

    const outcome = await edit({ title: 'Renamed' }, false);

    expect(outcome.mode).toBe('proposed');
    expect(outcome.book.title).toBe('Clean Code');
    expect(books.save).not.toHaveBeenCalled();
    expect(outcome.revision).toMatchObject({
      catalogBookId: 'c1',
      proposedBy: 'u2',
      changes: { title: { from: 'Clean Code', to: 'Renamed' } },
    });
  });

  it('replaces the proposer\'s earlier pending proposal instead of stacking them', async () => {
    const earlier = revision();
    revisions.findOne.mockResolvedValue(earlier);

    const outcome = await edit({ title: 'Second try' }, false);

    expect(outcome.revision?.id).toBe('r1');
    expect(outcome.revision?.changes).toEqual({ title: { from: 'Clean Code', to: 'Second try' } });
    expect(revisions.create).not.toHaveBeenCalled();
  });

  it('clears an optional field with blank or null', async () => {
    books.findOne.mockResolvedValue(stored({ publisher: 'Prentice Hall' }));

    const outcome = await edit({ publisher: '' }, true);

    expect(outcome.book.publisher).toBeNull();
  });

  it('refuses an edit that would turn the book into another catalog book', async () => {
    books.save.mockRejectedValueOnce(uniqueViolation());

    await expect(edit({ isbn: '9781234567897' }, true)).rejects.toMatchObject({ code: 'CATALOG_DUPLICATE', statusCode: 409 });
  });

  it('rejects an invalid ISBN in an edit', async () => {
    await expect(edit({ isbn: '123' }, true)).rejects.toMatchObject({ code: 'INVALID_ISBN' });
  });
});

describe('CatalogService.pendingRevisionsBy', () => {
  it('maps each book to the pending proposal of that user', async () => {
    qb.getMany.mockResolvedValue([revision()]);

    const map = await CatalogService.pendingRevisionsBy('u2', ['c1']);

    expect(map.get('c1')?.id).toBe('r1');
    expect(qb.where).toHaveBeenCalledWith('revision.proposedBy = :actorId', { actorId: 'u2' });
  });

  it('skips the query without books', async () => {
    expect((await CatalogService.pendingRevisionsBy('u2', [])).size).toBe(0);
    expect(revisions.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('moderation', () => {
  it('confirms a first registration once and audits it', async () => {
    books.findOne.mockResolvedValue(stored());

    const book = await CatalogService.confirmBook('admin-1', 'c1');

    expect(book.reviewStatus).toBe(CatalogReviewStatus.REVIEWED);
    expect(book.reviewedBy).toBe('admin-1');
    expect(AuditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'catalog.confirm', targetId: 'c1' }));

    books.findOne.mockResolvedValue(stored({ reviewStatus: CatalogReviewStatus.REVIEWED }));
    await CatalogService.confirmBook('admin-1', 'c1');
    expect(AuditService.record).toHaveBeenCalledTimes(1);
  });

  it('hides and restores a book, recording the reason', async () => {
    books.findOne.mockResolvedValue(stored());
    const hidden = await CatalogService.setHidden('admin-1', 'c1', true, 'nonsense entry');

    expect(hidden.status).toBe(CatalogBookStatus.HIDDEN);
    expect(hidden.reviewStatus).toBe(CatalogReviewStatus.REVIEWED);
    expect(AuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'catalog.hide', changes: { reason: 'nonsense entry' } }),
    );

    books.findOne.mockResolvedValue(stored({ status: CatalogBookStatus.HIDDEN }));
    const restored = await CatalogService.setHidden('admin-1', 'c1', false);
    expect(restored.status).toBe(CatalogBookStatus.ACTIVE);
    expect(AuditService.record).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'catalog.restore' }));
  });

  it('does not audit a visibility change that changes nothing', async () => {
    books.findOne.mockResolvedValue(stored());

    await CatalogService.setHidden('admin-1', 'c1', false);

    expect(AuditService.record).not.toHaveBeenCalled();
  });

  it('lets an admin edit directly, with an audit entry describing the change', async () => {
    books.findOne.mockResolvedValue(stored());

    const book = await CatalogService.adminEdit('admin-1', 'c1', { title: 'Fixed', pages: 464 });

    expect(book).toMatchObject({ title: 'Fixed', pages: 464 });
    expect(AuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'catalog.edit',
        changes: { title: { from: 'Clean Code', to: 'Fixed' }, pages: { from: null, to: 464 } },
      }),
    );
  });

  it('does not audit an admin edit that changes nothing', async () => {
    books.findOne.mockResolvedValue(stored());

    await CatalogService.adminEdit('admin-1', 'c1', { title: 'Clean Code' });

    expect(AuditService.record).not.toHaveBeenCalled();
  });

  it('lists books for review, oldest first, with filters', async () => {
    qb.getManyAndCount.mockResolvedValue([[stored()], 1]);

    await CatalogService.listBooksForReview({ review: CatalogReviewStatus.PENDING_REVIEW, status: CatalogBookStatus.ACTIVE, page: 1, limit: 20 });

    expect(qb.andWhere).toHaveBeenCalledWith('book.reviewStatus = :review', { review: CatalogReviewStatus.PENDING_REVIEW });
    expect(qb.andWhere).toHaveBeenCalledWith('book.status = :status', { status: CatalogBookStatus.ACTIVE });
    expect(qb.orderBy).toHaveBeenCalledWith('book.createdAt', 'ASC');
  });

  it('searches the review queue by title, author or ISBN', async () => {
    qb.getManyAndCount.mockResolvedValue([[stored()], 1]);

    await CatalogService.listBooksForReview({ search: 'clean', page: 1, limit: 20 });

    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('book.isbn LIKE :search'), { search: '%clean%' });
  });

  it('lists revisions together with their book', async () => {
    revisions.findAndCount.mockResolvedValue([[revision()], 1]);
    qb.getMany.mockResolvedValue([stored()]);

    const result = await CatalogService.listRevisions({ status: RevisionStatus.PENDING, page: 1, limit: 20 });

    expect(result.revisions[0].book?.title).toBe('Clean Code');
    expect(revisions.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { status: RevisionStatus.PENDING } }));
  });
});

describe('CatalogService.decideRevision', () => {
  beforeEach(() => {
    books.findOne.mockResolvedValue(stored());
  });

  it('applies an approved revision to the book and records the decision', async () => {
    revisions.findOne.mockResolvedValue(revision());

    const { book, revision: decided } = await CatalogService.decideRevision('admin-1', 'r1', 'approve', 'looks right');

    expect(book.title).toBe('Clean Code 2');
    expect(decided).toMatchObject({ status: RevisionStatus.APPROVED, reviewedBy: 'admin-1', reviewNote: 'looks right' });
    expect(AuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'catalog.revision.approve', targetType: 'catalog_book', targetId: 'c1' }),
    );
  });

  it('leaves the book alone when the revision is rejected', async () => {
    revisions.findOne.mockResolvedValue(revision());

    const { book, revision: decided } = await CatalogService.decideRevision('admin-1', 'r1', 'reject');

    expect(book.title).toBe('Clean Code');
    expect(books.save).not.toHaveBeenCalled();
    expect(decided.status).toBe(RevisionStatus.REJECTED);
    expect(decided.reviewNote).toBeNull();
  });

  it('answers 404 for an unknown revision and 409 for one already decided', async () => {
    revisions.findOne.mockResolvedValue(null);
    await expect(CatalogService.decideRevision('admin-1', 'nope', 'approve')).rejects.toMatchObject({ code: 'REVISION_NOT_FOUND' });

    revisions.findOne.mockResolvedValue(revision({ status: RevisionStatus.APPROVED }));
    await expect(CatalogService.decideRevision('admin-1', 'r1', 'approve')).rejects.toMatchObject({
      code: 'REVISION_ALREADY_DECIDED',
      statusCode: 409,
    });
  });

  it('cannot approve an edit that now collides with another book, and keeps it pending', async () => {
    revisions.findOne.mockResolvedValue(revision({ changes: { isbn: { from: null, to: '9781234567897' } } }));
    books.save.mockRejectedValueOnce(uniqueViolation());

    await expect(CatalogService.decideRevision('admin-1', 'r1', 'approve')).rejects.toMatchObject({ code: 'CATALOG_DUPLICATE' });
    expect(revisions.save).not.toHaveBeenCalled();
  });
});
