import { AppDataSource } from '../../config/database';
import { Book } from '../../models/Book';

export class StatsService {
  static async overview(userId?: string) {
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }

    const bookRepository = AppDataSource.getRepository(Book);

    // Buscar todos os livros do usuário
    const books = await bookRepository.find({
      where: { userId },
    });

    const total = books.length;

    // Contar por status
    const byStatus = {
      toRead: books.filter(b => b.status === 'to_read').length,
      reading: books.filter(b => b.status === 'reading').length,
      read: books.filter(b => b.status === 'read').length,
    };

    // Calcular média de rating (apenas livros com rating)
    const booksWithRating = books.filter(b => b.rating !== null && b.rating !== undefined);
    const averageRating = booksWithRating.length > 0
      ? booksWithRating.reduce((sum, b) => sum + (b.rating || 0), 0) / booksWithRating.length
      : 0;

    // Somar total de páginas (apenas livros com páginas)
    const totalPages = books
      .filter(b => b.pages !== null && b.pages !== undefined)
      .reduce((sum, b) => sum + (b.pages || 0), 0);

    return {
      stats: {
        total,
        byStatus,
        averageRating,
        totalPages,
        booksWithRating: booksWithRating.length,
      },
    };
  }
}