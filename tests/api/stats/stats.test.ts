import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';

describe('GET /api/stats', () => {
  let apiClient: ApiClient;
  let authHelper: AuthHelper;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    apiClient = new ApiClient();
    authHelper = new AuthHelper(apiClient);
    await cleanupTestDatabase();
    await authHelper.getAuthenticatedClient();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Cenários de Sucesso', () => {
    it('deve retornar estatísticas vazias quando usuário não tem livros', async () => {
      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toEqual({
        total: 0,
        byStatus: {
          toRead: 0,
          reading: 0,
          read: 0
        },
        averageRating: 0,
        totalPages: 0,
        booksWithRating: 0
      });
    });

    it('deve contar total de livros corretamente', async () => {
      await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.createBook(TestDataBuilder.createBook());

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.total).toBe(3);
    });

    it('deve contar livros por status corretamente', async () => {
      // Criar livros com diferentes status
      const book1 = await apiClient.createBook(TestDataBuilder.createBook());
      
      const book2 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBookStatus(book2.body.book.id, 'reading');

      const book3 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBookStatus(book3.body.book.id, 'reading');

      const book4 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBookStatus(book4.body.book.id, 'read');

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.byStatus).toEqual({
        toRead: 1,
        reading: 2,
        read: 1
      });
    });

    it('deve calcular média de rating corretamente', async () => {
      // Criar livros com ratings
      const book1 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBook(book1.body.book.id, { rating: 5 });

      const book2 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBook(book2.body.book.id, { rating: 4 });

      const book3 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBook(book3.body.book.id, { rating: 3 });

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.averageRating).toBe(4); // (5+4+3)/3 = 4
      expect(response.body.stats.booksWithRating).toBe(3);
    });

    it('deve ignorar livros sem rating no cálculo da média', async () => {
      // Livros com rating
      const book1 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBook(book1.body.book.id, { rating: 5 });

      const book2 = await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.updateBook(book2.body.book.id, { rating: 3 });

      // Livros sem rating
      await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.createBook(TestDataBuilder.createBook());

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.averageRating).toBe(4); // (5+3)/2 = 4
      expect(response.body.stats.booksWithRating).toBe(2);
      expect(response.body.stats.total).toBe(4);
    });

    it('deve somar total de páginas corretamente', async () => {
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 300 }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 450 }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 250 }));

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.totalPages).toBe(1000);
    });

    it('deve ignorar livros sem páginas no total', async () => {
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 300 }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: undefined }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 200 }));

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats.totalPages).toBe(500);
    });
  });

  it('deve retornar apenas estatísticas do usuário autenticado', async () => {
    // Garantir limpeza total antes deste teste
    await cleanupTestDatabase();
    
    // Usuário 1 cria 3 livros
    await apiClient.createBook(TestDataBuilder.createBook());
    await apiClient.createBook(TestDataBuilder.createBook());
    await apiClient.createBook(TestDataBuilder.createBook());
  
    // Usuário 2 cria 5 livros
    const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
    await client2.createBook(TestDataBuilder.createBook());
    await client2.createBook(TestDataBuilder.createBook());
    await client2.createBook(TestDataBuilder.createBook());
    await client2.createBook(TestDataBuilder.createBook());
    await client2.createBook(TestDataBuilder.createBook());
  
    // Verificar stats do usuário 1
    const stats1 = await apiClient.getStats();
    expect(stats1.body.stats.total).toBe(3);
  
    // Verificar stats do usuário 2
    const stats2 = await client2.getStats();
    expect(stats2.body.stats.total).toBe(5);
  });

  describe('Cenários Complexos', () => {
    it('deve calcular estatísticas completas corretamente', async () => {
      // Criar biblioteca completa
      const book1 = await apiClient.createBook(TestDataBuilder.createBook({ pages: 400 }));
      await apiClient.updateBook(book1.body.book.id, { rating: 5 });
      await apiClient.updateBookStatus(book1.body.book.id, 'read');

      const book2 = await apiClient.createBook(TestDataBuilder.createBook({ pages: 300 }));
      await apiClient.updateBook(book2.body.book.id, { rating: 4 });
      await apiClient.updateBookStatus(book2.body.book.id, 'read');

      const book3 = await apiClient.createBook(TestDataBuilder.createBook({ pages: 250 }));
      await apiClient.updateBookStatus(book3.body.book.id, 'reading');

      const book4 = await apiClient.createBook(TestDataBuilder.createBook({ pages: 500 }));

      const response = await apiClient.getStats();

      expect(response.status).toBe(200);
      expect(response.body.stats).toEqual({
        total: 4,
        byStatus: {
          toRead: 1,
          reading: 1,
          read: 2
        },
        averageRating: 4.5, // (5+4)/2
        totalPages: 1450,
        booksWithRating: 2
      });
    });

    it('deve recalcular estatísticas após deletar livro', async () => {
      const book1 = await apiClient.createBook(TestDataBuilder.createBook({ pages: 300 }));
      const book2 = await apiClient.createBook(TestDataBuilder.createBook({ pages: 200 }));
      await apiClient.createBook(TestDataBuilder.createBook({ pages: 100 }));

      // Stats iniciais
      let stats = await apiClient.getStats();
      expect(stats.body.stats.total).toBe(3);
      expect(stats.body.stats.totalPages).toBe(600);

      // Deletar um livro
      await apiClient.deleteBook(book1.body.book.id);

      // Stats atualizadas
      stats = await apiClient.getStats();
      expect(stats.body.stats.total).toBe(2);
      expect(stats.body.stats.totalPages).toBe(300);
    });
  });

  describe('Cenários de Autorização', () => {
    it('deve retornar erro 401 quando não enviar token', async () => {
      apiClient.clearToken();

      const response = await apiClient.getStats();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('deve retornar erro 401 quando enviar token inválido', async () => {
      apiClient.setToken('token-invalido');

      const response = await apiClient.getStats();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});