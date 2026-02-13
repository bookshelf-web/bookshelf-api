import { Repository, Like } from 'typeorm';
import { Book } from '../../models/Book';
import { AppDataSource } from '../../config/database';
import { CreateBookDTO, UpdateBookDTO, UpdateBookStatusDTO, BookStatus } from '../../types/books';

interface ListOptions {
  page?: number;
  limit?: number;
  status?: string;
  rating?: number;
  search?: string;
  title?: string;
  author?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export class BooksService {
  private static bookRepository: Repository<Book> = AppDataSource.getRepository(Book);

  static async create(data: CreateBookDTO & { userId?: string }) {
    const { title, author, isbn, publisher, publishedYear, pages, language, description, rating, notes, coverUrl, userId } = data;

    if (!userId) {
      throw new Error('Usuário não autenticado');
    }

    // Validações de campos obrigatórios
    if (!title || title.trim() === '') {
      throw new Error('Título é obrigatório');
    }

    if (!author || author.trim() === '') {
      throw new Error('Autor é obrigatório');
    }

    // Validação de ISBN duplicado
    if (isbn && isbn.trim() !== '') {
      const existingBook = await this.bookRepository.findOne({
        where: { isbn: isbn.trim() }
      });
      if (existingBook) {
        const error = new Error('ISBN já cadastrado');
        (error as any).statusCode = 409;
        throw error;
      }
    }

    // Validação de ano de publicação
    if (publishedYear && publishedYear > new Date().getFullYear()) {
      throw new Error('Ano de publicação não pode ser no futuro');
    }

    // Validação de rating
    if (rating !== undefined && rating !== null) {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating deve estar entre 1 e 5');
      }
    }

    const book = this.bookRepository.create({
      title: title.trim(),
      author: author.trim(),
      isbn: isbn?.trim() || undefined,
      publisher: publisher?.trim() || undefined,
      publishedYear: publishedYear || undefined,
      pages: pages !== undefined && pages !== null ? pages : undefined,
      language: language?.trim() || undefined,
      description: description?.trim() || undefined,
      rating: rating || undefined,
      notes: notes?.trim() || undefined,
      coverUrl: coverUrl?.trim() || undefined,
      userId,
      status: BookStatus.TO_READ,
    });

    const savedBook = await this.bookRepository.save(book);

    return {
      message: 'Livro criado com sucesso',
      book: savedBook,
    };
  }

  static async list(userId?: string, options: ListOptions = {}) {
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    // Construir where clause
    const where: any = { userId };

    if (options.status) {
      where.status = options.status;
    }

    if (options.rating) {
      where.rating = options.rating;
    }

    // Construir order clause
    let order: any = { createdAt: 'DESC' };
    
    if (options.sortBy) {
      const sortOrder = options.sortOrder || 'ASC';
      order = { [options.sortBy]: sortOrder };
    }

    // Query base
    let queryBuilder = this.bookRepository.createQueryBuilder('book')
      .where('book.userId = :userId', { userId });

    // Aplicar filtros
    if (options.status) {
      queryBuilder = queryBuilder.andWhere('book.status = :status', { status: options.status });
    }

    if (options.rating) {
      queryBuilder = queryBuilder.andWhere('book.rating = :rating', { rating: options.rating });
    }

    if (options.search) {
      queryBuilder = queryBuilder.andWhere(
        '(LOWER(book.title) LIKE LOWER(:search) OR LOWER(book.author) LIKE LOWER(:search))',
        { search: `%${options.search}%` }
      );
    }

    if (options.title) {
      queryBuilder = queryBuilder.andWhere(
        'LOWER(book.title) LIKE LOWER(:title)',
        { title: `%${options.title}%` }
      );
    }

    if (options.author) {
      queryBuilder = queryBuilder.andWhere(
        'LOWER(book.author) LIKE LOWER(:author)',
        { author: `%${options.author}%` }
      );
    }

    // Aplicar ordenação
    if (options.sortBy) {
      const sortOrder = options.sortOrder || 'ASC';
      queryBuilder = queryBuilder.orderBy(`book.${options.sortBy}`, sortOrder);
    } else {
      queryBuilder = queryBuilder.orderBy('book.createdAt', 'DESC');
    }

    // Paginação
    queryBuilder = queryBuilder.skip(skip).take(limit);

    const [books, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  static async getById(id: string, userId?: string) {
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }

    const book = await this.bookRepository.findOne({
      where: { id, userId },
    });

    if (!book) {
      const error = new Error('Livro não encontrado');
      (error as any).statusCode = 404;
      throw error;
    }

    return book;
  }

  static async update(id: string, data: UpdateBookDTO, userId?: string) {
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }

    const book = await this.getById(id, userId);

    // Validação de ISBN duplicado se mudou
    if (data.isbn && data.isbn.trim() !== '' && data.isbn !== book.isbn) {
      const existingBook = await this.bookRepository.findOne({
        where: { isbn: data.isbn.trim() }
      });
      if (existingBook) {
        const error = new Error('ISBN já cadastrado');
        (error as any).statusCode = 409;
        throw error;
      }
    }

    // Validação de ano de publicação
    if (data.publishedYear && data.publishedYear > new Date().getFullYear()) {
      throw new Error('Ano de publicação não pode ser no futuro');
    }

    // Validação de rating
    if (data.rating !== undefined && data.rating !== null) {
      if (data.rating < 1 || data.rating > 5) {
        throw new Error('Rating deve estar entre 1 e 5');
      }
    }

    // Atualizar campos - usando undefined ao invés de null
    if (data.title !== undefined) book.title = data.title.trim();
    if (data.author !== undefined) book.author = data.author.trim();
    if (data.isbn !== undefined) book.isbn = data.isbn?.trim() || undefined;
    if (data.publisher !== undefined) book.publisher = data.publisher?.trim() || undefined;
    if (data.publishedYear !== undefined) book.publishedYear = data.publishedYear || undefined;
    if (data.pages !== undefined) book.pages = data.pages !== null ? data.pages : undefined;
    if (data.language !== undefined) book.language = data.language?.trim() || undefined;
    if (data.description !== undefined) book.description = data.description?.trim() || undefined;
    if (data.status !== undefined) book.status = data.status;
    if (data.rating !== undefined) book.rating = data.rating || undefined;
    if (data.notes !== undefined) {
      if (data.notes === null || data.notes === '') {
        book.notes = undefined;
      } else {
        book.notes = data.notes;
      }
    }
    if (data.coverUrl !== undefined) book.coverUrl = data.coverUrl?.trim() || undefined;

    const updatedBook = await this.bookRepository.save(book);

    return {
      message: 'Livro atualizado com sucesso',
      book: updatedBook,
    };
  }

  static async updateStatus(id: string, data: UpdateBookStatusDTO, userId?: string) {
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }

    const book = await this.getById(id, userId);

    // Validação de status
    if (!data.status || data.status.trim() === '') {
      throw new Error('Status é obrigatório');
    }

    const validStatuses = ['to_read', 'reading', 'read'];
    if (!validStatuses.includes(data.status)) {
      throw new Error('Status inválido. Use: to_read, reading ou read');
    }

    // Lógica de datas automáticas
    if (data.status === BookStatus.READING && !book.startedAt) {
      book.startedAt = new Date();
    }

    if (data.status === BookStatus.READ && !book.finishedAt) {
      book.finishedAt = new Date();
    }

    book.status = data.status;

    const updatedBook = await this.bookRepository.save(book);

    return {
      message: 'Status atualizado com sucesso',
      book: updatedBook,
    };
  }

  static async remove(id: string, userId?: string) {
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }

    const book = await this.getById(id, userId);

    await this.bookRepository.remove(book);

    return {
      message: 'Livro removido com sucesso',
    };
  }
}