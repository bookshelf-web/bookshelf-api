import { AppDataSource } from '../config/database';
import { Book } from '../models/Book';
import { BookStatus, CreateBookDTO, UpdateBookDTO, BookFilters } from '../types';
import { FindManyOptions, Like, ILike } from 'typeorm';

export class BooksService {
  private bookRepository = AppDataSource.getRepository(Book);

  async createBook(userId: string, bookData: CreateBookDTO): Promise<Book> {
    // Validar ISBN duplicado se fornecido
    if (bookData.isbn) {
      const existingBook = await this.bookRepository.findOne({
        where: { isbn: bookData.isbn }
      });
      if (existingBook) {
        throw new Error('ISBN já cadastrado');
      }
    }

    // Validar ano de publicação
    if (bookData.publishedYear && bookData.publishedYear > new Date().getFullYear()) {
      throw new Error('Ano de publicação não pode ser no futuro');
    }

    const book = this.bookRepository.create({
      ...bookData,
      userId,
    });

    return await this.bookRepository.save(book);
  }

  async getBooks(userId: string, filters: BookFilters): Promise<{ books: Book[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    // Aplicar filtros
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.rating) {
      where.rating = filters.rating;
    }
    if (filters.author) {
      where.author = ILike(`%${filters.author}%`);
    }
    if (filters.title) {
      where.title = ILike(`%${filters.title}%`);
    }
    if (filters.publishedYear) {
      where.publishedYear = filters.publishedYear;
    }

    const order: any = {};
    if (filters.sortBy) {
      order[filters.sortBy] = filters.sortOrder || 'ASC';
    } else {
      order.createdAt = 'DESC';
    }

    const [books, total] = await this.bookRepository.findAndCount({
      where,
      order,
      skip,
      take: limit,
    });

    return { books, total };
  }

  async getBookById(userId: string, bookId: string): Promise<Book> {
    const book = await this.bookRepository.findOne({
      where: { id: bookId, userId }
    });

    if (!book) {
      throw new Error('Livro não encontrado');
    }

    return book;
  }

  async updateBook(userId: string, bookId: string, updateData: UpdateBookDTO): Promise<Book> {
    const book = await this.getBookById(userId, bookId);

    // Validar ISBN duplicado se mudou
    if (updateData.isbn && updateData.isbn !== book.isbn) {
      const existingBook = await this.bookRepository.findOne({
        where: { isbn: updateData.isbn }
      });
      if (existingBook) {
        throw new Error('ISBN já cadastrado');
      }
    }

    // Validar rating
    if (updateData.rating && (updateData.rating < 1 || updateData.rating > 5)) {
      throw new Error('Rating deve estar entre 1 e 5');
    }

    // Validar ano de publicação
    if (updateData.publishedYear && updateData.publishedYear > new Date().getFullYear()) {
      throw new Error('Ano de publicação não pode ser no futuro');
    }

    // Atualizar campos
    Object.assign(book, updateData);

    return await this.bookRepository.save(book);
  }

  async updateBookStatus(userId: string, bookId: string, status: BookStatus): Promise<Book> {
    const book = await this.getBookById(userId, bookId);

    book.status = status;

    // Regras de negócio para datas
    if (status === BookStatus.READING && !book.startedAt) {
      book.startedAt = new Date();
    }

    if (status === BookStatus.READ && !book.finishedAt) {
      book.finishedAt = new Date();
    }

    // Validar que finished_at >= started_at
    if (book.startedAt && book.finishedAt && book.finishedAt < book.startedAt) {
      throw new Error('Data de término não pode ser anterior à data de início');
    }

    return await this.bookRepository.save(book);
  }

  async deleteBook(userId: string, bookId: string): Promise<void> {
    const book = await this.getBookById(userId, bookId);
    await this.bookRepository.remove(book);
  }

  async getStats(userId: string): Promise<any> {
    const books = await this.bookRepository.find({ where: { userId } });

    const stats = {
      total: books.length,
      byStatus: {
        toRead: books.filter(b => b.status === BookStatus.TO_READ).length,
        reading: books.filter(b => b.status === BookStatus.READING).length,
        read: books.filter(b => b.status === BookStatus.READ).length,
      },
      averageRating: 0,
      totalPages: 0,
      booksWithRating: 0,
    };

    const booksWithRating = books.filter(b => b.rating);
    if (booksWithRating.length > 0) {
      const sumRatings = booksWithRating.reduce((sum, b) => sum + (b.rating || 0), 0);
      stats.averageRating = parseFloat((sumRatings / booksWithRating.length).toFixed(2));
      stats.booksWithRating = booksWithRating.length;
    }

    stats.totalPages = books.reduce((sum, b) => sum + (b.pages || 0), 0);

    return stats;
  }
}