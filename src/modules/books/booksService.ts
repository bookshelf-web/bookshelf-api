import { AppDataSource } from '../../config/database';
import { Book } from '../../models/Book';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { BookStatus } from '../../types/books';
import { CreateBookInput, ListBooksQuery, SORTABLE_COLUMNS, UpdateBookInput } from './booksSchemas';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class BooksService {
  private static get repository() {
    return AppDataSource.getRepository(Book);
  }

  static async create(userId: string, data: CreateBookInput): Promise<Book> {
    await this.assertIsbnAvailable(data.isbn);

    const book = this.repository.create({
      ...data,
      userId,
      status: BookStatus.TO_READ,
    });

    return this.repository.save(book);
  }

  static async list(userId: string, query: ListBooksQuery) {
    const { page, limit } = query;

    const qb = this.repository
      .createQueryBuilder('book')
      .where('book.userId = :userId', { userId });

    if (query.status) qb.andWhere('book.status = :status', { status: query.status });
    if (query.rating) qb.andWhere('book.rating = :rating', { rating: query.rating });

    if (query.search) {
      qb.andWhere(
        '(LOWER(book.title) LIKE LOWER(:search) OR LOWER(book.author) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }
    if (query.title) {
      qb.andWhere('LOWER(book.title) LIKE LOWER(:title)', { title: `%${query.title}%` });
    }
    if (query.author) {
      qb.andWhere('LOWER(book.author) LIKE LOWER(:author)', { author: `%${query.author}%` });
    }

    if (query.sortBy && SORTABLE_COLUMNS.includes(query.sortBy)) {
      qb.orderBy(`book.${query.sortBy}`, query.sortOrder ?? 'ASC');
    } else {
      qb.orderBy('book.createdAt', 'DESC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [books, total] = await qb.getManyAndCount();

    const pagination: Pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    return { books, pagination };
  }

  static async getById(userId: string, id: string): Promise<Book> {
    const book = await this.repository.findOne({ where: { id, userId } });
    if (!book) {
      throw new NotFoundError('Book not found', 'BOOK_NOT_FOUND');
    }
    return book;
  }

  static async update(userId: string, id: string, data: UpdateBookInput): Promise<Book> {
    const book = await this.getById(userId, id);

    if (data.isbn && data.isbn.trim() !== book.isbn) {
      await this.assertIsbnAvailable(data.isbn);
    }

    if (data.title !== undefined) book.title = data.title;
    if (data.author !== undefined) book.author = data.author;
    if (data.status !== undefined) book.status = data.status;
    if (data.isbn !== undefined) book.isbn = data.isbn?.trim() || undefined;
    if (data.publisher !== undefined) book.publisher = data.publisher?.trim() || undefined;
    if (data.publishedYear !== undefined) book.publishedYear = data.publishedYear ?? undefined;
    if (data.pages !== undefined) book.pages = data.pages ?? undefined;
    if (data.language !== undefined) book.language = data.language?.trim() || undefined;
    if (data.description !== undefined) book.description = data.description?.trim() || undefined;
    if (data.rating !== undefined) book.rating = data.rating ?? undefined;
    // Free-form text: preserve the value as sent, only clearing on null/empty.
    if (data.notes !== undefined) book.notes = data.notes || undefined;
    if (data.coverUrl !== undefined) book.coverUrl = data.coverUrl?.trim() || undefined;

    return this.repository.save(book);
  }

  static async updateStatus(userId: string, id: string, status: BookStatus): Promise<Book> {
    const book = await this.getById(userId, id);

    if (status === BookStatus.READING && !book.startedAt) {
      book.startedAt = new Date();
    }
    if (status === BookStatus.READ && !book.finishedAt) {
      book.finishedAt = new Date();
    }
    book.status = status;

    return this.repository.save(book);
  }

  static async remove(userId: string, id: string): Promise<void> {
    const book = await this.getById(userId, id);
    await this.repository.remove(book);
  }

  private static async assertIsbnAvailable(isbn?: string | null): Promise<void> {
    if (!isbn || isbn.trim() === '') return;

    const existing = await this.repository.findOne({
      where: { isbn: isbn.trim() },
      select: ['id'],
    });
    if (existing) {
      throw new ConflictError('ISBN is already registered', 'ISBN_ALREADY_REGISTERED');
    }
  }
}
