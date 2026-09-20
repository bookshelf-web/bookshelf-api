import { QueryFailedError } from 'typeorm';
import { AppDataSource } from '../../config/database';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../shared/errors';
import { AuditService } from '../audit';
import { normalizeIsbn } from './isbn';
import { CatalogBook, CatalogBookStatus, CatalogReviewStatus } from './models/CatalogBook';
import { CatalogRevision, RevisionStatus } from './models/CatalogRevision';

/** Fields a user (or admin) can propose to change on a catalog book. */
export const EDITABLE_FIELDS = [
  'title',
  'author',
  'isbn',
  'publisher',
  'publishedYear',
  'edition',
  'pages',
  'language',
  'description',
  'coverUrl',
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

export interface CatalogFields {
  title: string;
  author: string;
  isbn?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  edition?: string | null;
  pages?: number | null;
  language?: string | null;
  description?: string | null;
  coverUrl?: string | null;
}

export type CatalogChanges = Partial<CatalogFields>;

const POSTGRES_UNIQUE_VIOLATION = '23505';

export function normalizeText(value: string | number | null | undefined): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** `isbn:<isbn13>` for books with a valid ISBN, otherwise a key built from their metadata. */
export function dedupeKeyFor(fields: Pick<CatalogFields, 'title' | 'author' | 'isbn' | 'publisher' | 'publishedYear' | 'edition'>): string {
  const isbn = normalizeIsbn(fields.isbn);
  if (isbn) return `isbn:${isbn}`;
  const parts = [fields.title, fields.author, fields.publisher, fields.publishedYear, fields.edition];
  return `meta:${parts.map(normalizeText).join('|')}`.slice(0, 700);
}

/** Validates and normalises an ISBN the caller sent; an empty value means "no ISBN". */
function resolveIsbn(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null || raw.trim() === '') return null;
  const isbn = normalizeIsbn(raw);
  if (!isbn) {
    throw new BadRequestError('ISBN is not valid (expected a valid ISBN-10 or ISBN-13)', 'INVALID_ISBN');
  }
  return isbn;
}

export interface EditOutcome {
  mode: 'applied' | 'proposed' | 'unchanged';
  book: CatalogBook;
  revision?: CatalogRevision;
}

export class CatalogService {
  private static get books() {
    return AppDataSource.getRepository(CatalogBook);
  }

  private static get revisions() {
    return AppDataSource.getRepository(CatalogRevision);
  }

  // ─── Registration ────────────────────────────────────────────────────────

  /**
   * Returns the catalog book for these fields, registering it when it is new. The first
   * registration is usable at once and flagged for an admin to review.
   */
  static async findOrCreate(userId: string, fields: CatalogFields): Promise<{ book: CatalogBook; created: boolean }> {
    const isbn = resolveIsbn(fields.isbn);
    const dedupeKey = dedupeKeyFor({ ...fields, isbn });

    const existing = await this.books.findOne({ where: { dedupeKey } });
    if (existing) return { book: this.assertUsable(existing), created: false };

    try {
      const book = await this.books.save(
        this.books.create({
          isbn,
          dedupeKey,
          title: fields.title,
          author: fields.author,
          publisher: fields.publisher ?? null,
          publishedYear: fields.publishedYear ?? null,
          edition: fields.edition ?? null,
          pages: fields.pages ?? null,
          language: fields.language ?? null,
          description: fields.description ?? null,
          coverUrl: fields.coverUrl ?? null,
          status: CatalogBookStatus.ACTIVE,
          reviewStatus: CatalogReviewStatus.PENDING_REVIEW,
          createdBy: userId,
        }),
      );
      return { book, created: true };
    } catch (error) {
      // Two users registering the same new book at once: the loser reuses the winner's row.
      if (isUniqueViolation(error)) {
        const winner = await this.books.findOne({ where: { dedupeKey } });
        if (winner) return { book: this.assertUsable(winner), created: false };
      }
      throw error;
    }
  }

  static async getById(id: string): Promise<CatalogBook> {
    const book = await this.books.findOne({ where: { id } });
    if (!book) {
      throw new NotFoundError('Catalog book not found', 'CATALOG_BOOK_NOT_FOUND');
    }
    return book;
  }

  static async findByIds(ids: string[]): Promise<Map<string, CatalogBook>> {
    if (ids.length === 0) return new Map();
    const books = await this.books
      .createQueryBuilder('book')
      .where('book.id IN (:...ids)', { ids })
      .getMany();
    return new Map(books.map(book => [book.id, book]));
  }

  // ─── Reading ─────────────────────────────────────────────────────────────

  /** Active books only, for pickers and (later) the bookstore. Filter by ISBN or free text. */
  static async search({ isbn, search, page, limit }: { isbn?: string; search?: string; page: number; limit: number }) {
    const qb = this.books
      .createQueryBuilder('book')
      .where('book.status = :status', { status: CatalogBookStatus.ACTIVE });

    if (isbn) {
      const normalized = normalizeIsbn(isbn);
      // An invalid ISBN cannot match anything.
      qb.andWhere('book.isbn = :isbn', { isbn: normalized ?? '' });
    }
    if (search) {
      qb.andWhere('(LOWER(book.title) LIKE LOWER(:search) OR LOWER(book.author) LIKE LOWER(:search))', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('book.title', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [books, total] = await qb.getManyAndCount();
    return { books, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Edits ───────────────────────────────────────────────────────────────

  /**
   * Applies or proposes a change. `canEditDirectly` is decided by the caller (the library
   * knows how many people shelve the book); everyone else's edit becomes a revision that an
   * admin has to approve.
   */
  static async submitEdit(params: {
    actorId: string;
    catalogBookId: string;
    changes: CatalogChanges;
    canEditDirectly: boolean;
  }): Promise<EditOutcome> {
    const book = await this.getById(params.catalogBookId);
    const diff = this.diff(book, params.changes);

    if (Object.keys(diff).length === 0) return { mode: 'unchanged', book };

    if (params.canEditDirectly) {
      return { mode: 'applied', book: await this.applyDiff(book, diff) };
    }

    const revision = await this.upsertRevision(params.actorId, book, diff);
    return { mode: 'proposed', book, revision };
  }

  /** The latest pending revision each user proposed, keyed by catalog book id. */
  static async pendingRevisionsBy(actorId: string, bookIds: string[]): Promise<Map<string, CatalogRevision>> {
    if (bookIds.length === 0) return new Map();
    const revisions = await this.revisions
      .createQueryBuilder('revision')
      .where('revision.proposedBy = :actorId', { actorId })
      .andWhere('revision.status = :status', { status: RevisionStatus.PENDING })
      .andWhere('revision.catalogBookId IN (:...bookIds)', { bookIds })
      .getMany();
    return new Map(revisions.map(revision => [revision.catalogBookId, revision]));
  }

  // ─── Moderation (admin) ──────────────────────────────────────────────────

  static async listBooksForReview(params: { review?: CatalogReviewStatus; status?: CatalogBookStatus; page: number; limit: number }) {
    const qb = this.books.createQueryBuilder('book');
    if (params.review) qb.andWhere('book.reviewStatus = :review', { review: params.review });
    if (params.status) qb.andWhere('book.status = :status', { status: params.status });
    qb.orderBy('book.createdAt', 'ASC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);

    const [books, total] = await qb.getManyAndCount();
    return { books, pagination: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) } };
  }

  static async listRevisions(params: { status?: RevisionStatus; page: number; limit: number }) {
    const [revisions, total] = await this.revisions.findAndCount({
      where: params.status ? { status: params.status } : {},
      order: { createdAt: 'ASC' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    });
    const books = await this.findByIds([...new Set(revisions.map(revision => revision.catalogBookId))]);
    return {
      revisions: revisions.map(revision => ({ ...revision, book: books.get(revision.catalogBookId) ?? null })),
      pagination: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
    };
  }

  /** The admin confirms a first registration looked fine. */
  static async confirmBook(adminId: string, id: string): Promise<CatalogBook> {
    const book = await this.getById(id);
    if (book.reviewStatus === CatalogReviewStatus.REVIEWED) return book;

    book.reviewStatus = CatalogReviewStatus.REVIEWED;
    book.reviewedBy = adminId;
    book.reviewedAt = new Date();
    const saved = await this.books.save(book);
    await AuditService.record({ actorId: adminId, action: 'catalog.confirm', targetType: 'catalog_book', targetId: id });
    return saved;
  }

  /** The admin takes a book down (or brings it back). Shelves keep their entry, the bookstore hides it. */
  static async setHidden(adminId: string, id: string, hidden: boolean, reason?: string): Promise<CatalogBook> {
    const book = await this.getById(id);
    const status = hidden ? CatalogBookStatus.HIDDEN : CatalogBookStatus.ACTIVE;
    if (book.status === status) return book;

    book.status = status;
    if (hidden) {
      book.reviewStatus = CatalogReviewStatus.REVIEWED;
      book.reviewedBy = adminId;
      book.reviewedAt = new Date();
    }
    const saved = await this.books.save(book);
    await AuditService.record({
      actorId: adminId,
      action: hidden ? 'catalog.hide' : 'catalog.restore',
      targetType: 'catalog_book',
      targetId: id,
      changes: reason ? { reason } : null,
    });
    return saved;
  }

  /** Admins edit the catalog directly; the change is audited instead of reviewed. */
  static async adminEdit(adminId: string, id: string, changes: CatalogChanges): Promise<CatalogBook> {
    const book = await this.getById(id);
    const diff = this.diff(book, changes);
    if (Object.keys(diff).length === 0) return book;

    const saved = await this.applyDiff(book, diff);
    await AuditService.record({ actorId: adminId, action: 'catalog.edit', targetType: 'catalog_book', targetId: id, changes: diff });
    return saved;
  }

  static async decideRevision(
    adminId: string,
    revisionId: string,
    decision: 'approve' | 'reject',
    note?: string,
  ): Promise<{ revision: CatalogRevision; book: CatalogBook }> {
    const revision = await this.revisions.findOne({ where: { id: revisionId } });
    if (!revision) {
      throw new NotFoundError('Revision not found', 'REVISION_NOT_FOUND');
    }
    if (revision.status !== RevisionStatus.PENDING) {
      throw new ConflictError('This revision was already decided', 'REVISION_ALREADY_DECIDED');
    }

    let book = await this.getById(revision.catalogBookId);
    if (decision === 'approve') {
      const diff = this.diff(book, this.toChanges(revision.changes));
      if (Object.keys(diff).length > 0) book = await this.applyDiff(book, diff);
    }

    revision.status = decision === 'approve' ? RevisionStatus.APPROVED : RevisionStatus.REJECTED;
    revision.reviewedBy = adminId;
    revision.reviewedAt = new Date();
    revision.reviewNote = note ?? null;
    const saved = await this.revisions.save(revision);

    await AuditService.record({
      actorId: adminId,
      action: decision === 'approve' ? 'catalog.revision.approve' : 'catalog.revision.reject',
      targetType: 'catalog_book',
      targetId: book.id,
      changes: { revisionId, ...(note ? { note } : {}), fields: revision.changes },
    });

    return { revision: saved, book };
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private static assertUsable(book: CatalogBook): CatalogBook {
    if (book.status === CatalogBookStatus.HIDDEN) {
      throw new ConflictError('This book was removed from the catalog', 'CATALOG_BOOK_HIDDEN');
    }
    return book;
  }

  /** Compares the requested values with the stored ones and keeps only real differences. */
  private static diff(book: CatalogBook, changes: CatalogChanges): Record<string, { from: unknown; to: unknown }> {
    const diff: Record<string, { from: unknown; to: unknown }> = {};

    for (const field of EDITABLE_FIELDS) {
      if (!(field in changes) || changes[field] === undefined) continue;

      let next: unknown = changes[field];
      if (field === 'isbn') next = resolveIsbn(changes.isbn);
      else if (next === '') next = null;

      const current = (book[field] ?? null) as unknown;
      if (next !== current) diff[field] = { from: current, to: next ?? null };
    }
    return diff;
  }

  private static toChanges(diff: Record<string, { from: unknown; to: unknown }>): CatalogChanges {
    return Object.fromEntries(Object.entries(diff).map(([field, { to }]) => [field, to])) as CatalogChanges;
  }

  private static async applyDiff(book: CatalogBook, diff: Record<string, { from: unknown; to: unknown }>): Promise<CatalogBook> {
    for (const [field, { to }] of Object.entries(diff)) {
      (book as unknown as Record<string, unknown>)[field] = to;
    }
    book.dedupeKey = dedupeKeyFor(book);

    try {
      return await this.books.save(book);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Another catalog book already has this identity', 'CATALOG_DUPLICATE');
      }
      throw error;
    }
  }

  private static async upsertRevision(
    actorId: string,
    book: CatalogBook,
    diff: Record<string, { from: unknown; to: unknown }>,
  ): Promise<CatalogRevision> {
    const pending = await this.revisions.findOne({
      where: { catalogBookId: book.id, proposedBy: actorId, status: RevisionStatus.PENDING },
    });
    if (pending) {
      pending.changes = diff;
      return this.revisions.save(pending);
    }
    return this.revisions.save(this.revisions.create({ catalogBookId: book.id, proposedBy: actorId, changes: diff }));
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error as QueryFailedError & { code?: string }).code === POSTGRES_UNIQUE_VIOLATION;
}
