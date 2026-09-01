import { AppDataSource } from '../../config/database';
import { Book } from '../../models/Book';
import { BookStatus } from '../../types/books';

interface Overview {
  total: number;
  byStatus: { toRead: number; reading: number; read: number };
  averageRating: number;
  totalPages: number;
  booksWithRating: number;
}

export class StatsService {
  static async overview(userId: string): Promise<Overview> {
    const books = await AppDataSource.getRepository(Book).find({
      where: { userId },
      select: ['status', 'rating', 'pages'],
    });

    const ratings = books
      .map(book => book.rating)
      .filter((value): value is number => typeof value === 'number');

    const totalPages = books.reduce((sum, book) => sum + (book.pages ?? 0), 0);

    return {
      total: books.length,
      byStatus: {
        toRead: countByStatus(books, BookStatus.TO_READ),
        reading: countByStatus(books, BookStatus.READING),
        read: countByStatus(books, BookStatus.READ),
      },
      averageRating: ratings.length
        ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
        : 0,
      totalPages,
      booksWithRating: ratings.length,
    };
  }
}

function countByStatus(books: Book[], status: BookStatus): number {
  return books.filter(book => book.status === status).length;
}
