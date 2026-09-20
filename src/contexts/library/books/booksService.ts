import { Not } from 'typeorm';
import { AppDataSource } from '../../../config/database';
import { ConflictError, NotFoundError } from '../../../shared/errors';
import {
  CatalogBook,
  CatalogChanges,
  CatalogReviewStatus,
  CatalogService,
  CatalogRevision,
  EDITABLE_FIELDS,
} from '../../catalog';
import { Book } from '../models/Book';
import { BookStatus } from '../types';
import { CreateBookInput, ListBooksQuery, UpdateBookInput } from './booksSchemas';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** A shelf entry together with the catalog data that describes the book. */
export interface BookView {
  id: string;
  userId: string;
  catalogBookId: string;
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
  rating?: number | null;
  notes?: string | null;
  status: BookStatus;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** How the catalog treats this book (a first registration awaits an admin's review). */
  catalog: { status: string; reviewStatus: string };
  /** The reader's own proposed edit, waiting for an admin, if any. */
  pendingRevision: { id: string; changes: Record<string, { from: unknown; to: unknown }> } | null;
}

/** Sortable columns and where each one lives (the whitelist guards against SQL injection). */
const SORT_COLUMNS: Record<string, string> = {
  title: 'catalog.title',
  author: 'catalog.author',
  pages: 'catalog.pages',
  publishedYear: 'catalog.publishedYear',
  status: 'book.status',
  rating: 'book.rating',
  createdAt: 'book.createdAt',
  updatedAt: 'book.updatedAt',
};

export function toBookView(book: Book, catalog: CatalogBook, revision?: CatalogRevision | null): BookView {
  return {
    id: book.id,
    userId: book.userId,
    catalogBookId: book.catalogBookId,
    title: catalog.title,
    author: catalog.author,
    isbn: catalog.isbn,
    publisher: catalog.publisher,
    publishedYear: catalog.publishedYear,
    edition: catalog.edition,
    pages: catalog.pages,
    language: catalog.language,
    description: catalog.description,
    coverUrl: catalog.coverUrl,
    rating: book.rating,
    notes: book.notes,
    status: book.status,
    startedAt: book.startedAt,
    finishedAt: book.finishedAt,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    catalog: { status: catalog.status, reviewStatus: catalog.reviewStatus },
    pendingRevision: revision ? { id: revision.id, changes: revision.changes } : null,
  };
}

export class BooksService {
  private static get repository() {
    return AppDataSource.getRepository(Book);
  }

  static async create(userId: string, data: CreateBookInput): Promise<BookView> {
    const { rating, notes, ...metadata } = data;
    const { book: catalog } = await CatalogService.findOrCreate(userId, metadata);

    if (await this.repository.exists({ where: { userId, catalogBookId: catalog.id } })) {
      throw new ConflictError(
        metadata.isbn ? 'ISBN is already registered' : 'This book is already in your library',
        metadata.isbn ? 'ISBN_ALREADY_REGISTERED' : 'BOOK_ALREADY_IN_LIBRARY',
      );
    }

    const book = await this.repository.save(
      this.repository.create({
        userId,
        catalogBookId: catalog.id,
        rating: rating ?? null,
        notes: notes ?? null,
        status: BookStatus.TO_READ,
      }),
    );

    return toBookView(book, catalog);
  }

  static async list(userId: string, query: ListBooksQuery) {
    const { page, limit } = query;

    const qb = this.repository
      .createQueryBuilder('book')
      .innerJoinAndSelect('book.catalogBook', 'catalog')
      .where('book.userId = :userId', { userId });

    if (query.status) qb.andWhere('book.status = :status', { status: query.status });
    if (query.rating) qb.andWhere('book.rating = :rating', { rating: query.rating });

    if (query.search) {
      qb.andWhere(
        '(LOWER(catalog.title) LIKE LOWER(:search) OR LOWER(catalog.author) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }
    if (query.title) {
      qb.andWhere('LOWER(catalog.title) LIKE LOWER(:title)', { title: `%${query.title}%` });
    }
    if (query.author) {
      qb.andWhere('LOWER(catalog.author) LIKE LOWER(:author)', { author: `%${query.author}%` });
    }

    const sortColumn = query.sortBy ? SORT_COLUMNS[query.sortBy] : undefined;
    if (sortColumn) {
      qb.orderBy(sortColumn, query.sortOrder ?? 'ASC');
    } else {
      qb.orderBy('book.createdAt', 'DESC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    const revisions = await CatalogService.pendingRevisionsBy(
      userId,
      rows.map(row => row.catalogBookId),
    );

    const pagination: Pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    return {
      books: rows.map(row => toBookView(row, row.catalogBook as CatalogBook, revisions.get(row.catalogBookId))),
      pagination,
    };
  }

  static async getById(userId: string, id: string): Promise<BookView> {
    const book = await this.requireEntry(userId, id);
    const revisions = await CatalogService.pendingRevisionsBy(userId, [book.catalogBookId]);
    return toBookView(book, book.catalogBook as CatalogBook, revisions.get(book.catalogBookId));
  }

  /**
   * Personal fields (rating, notes, status) apply at once. Changes to what the book *is* go
   * through the catalog: a reader may fix their own fresh registration until an admin has
   * reviewed it, and every other edit becomes a proposal an admin has to approve.
   */
  static async update(userId: string, id: string, data: UpdateBookInput): Promise<BookView> {
    const book = await this.requireEntry(userId, id);
    let catalog = book.catalogBook as CatalogBook;
    let revision: CatalogRevision | null | undefined;

    const metadata = this.pickMetadata(data);
    if (Object.keys(metadata).length > 0) {
      const sharedWithOthers =
        (await this.repository.count({ where: { catalogBookId: catalog.id, userId: Not(userId) } })) > 0;
      const canEditDirectly =
        catalog.reviewStatus === CatalogReviewStatus.PENDING_REVIEW &&
        catalog.createdBy === userId &&
        !sharedWithOthers;

      const outcome = await CatalogService.submitEdit({
        actorId: userId,
        catalogBookId: catalog.id,
        changes: metadata,
        canEditDirectly,
      });
      catalog = outcome.book;
      revision = outcome.revision;
    }

    if (data.status !== undefined) book.status = data.status;
    // Cleared fields are set to null: TypeORM ignores undefined on save.
    if (data.rating !== undefined) book.rating = data.rating ?? null;
    // Free-form text: preserve the value as sent, only clearing on null/empty.
    if (data.notes !== undefined) book.notes = data.notes || null;
    const saved = await this.repository.save(book);

    if (revision === undefined) {
      const pending = await CatalogService.pendingRevisionsBy(userId, [catalog.id]);
      revision = pending.get(catalog.id);
    }
    return toBookView(saved, catalog, revision);
  }

  static async updateStatus(userId: string, id: string, status: BookStatus): Promise<BookView> {
    const book = await this.requireEntry(userId, id);

    if (status === BookStatus.READING && !book.startedAt) {
      book.startedAt = new Date();
    }
    if (status === BookStatus.READ && !book.finishedAt) {
      book.finishedAt = new Date();
    }
    book.status = status;

    const saved = await this.repository.save(book);
    return toBookView(saved, book.catalogBook as CatalogBook);
  }

  static async remove(userId: string, id: string): Promise<void> {
    const book = await this.requireEntry(userId, id);
    await this.repository.remove(book);
  }

  private static async requireEntry(userId: string, id: string): Promise<Book> {
    const book = await this.repository.findOne({
      where: { id, userId },
      relations: { catalogBook: true },
    });
    if (!book) {
      throw new NotFoundError('Book not found', 'BOOK_NOT_FOUND');
    }
    return book;
  }

  private static pickMetadata(data: UpdateBookInput): CatalogChanges {
    const changes: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      const value = (data as Record<string, unknown>)[field];
      if (value !== undefined) changes[field] = typeof value === 'string' ? value.trim() : value;
    }
    return changes as CatalogChanges;
  }
}
