import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';

describe('GET /api/books', () => {
  let apiClient: ApiClient;
  let authHelper: AuthHelper;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    apiClient = new ApiClient();
    authHelper = new AuthHelper(apiClient);
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Cenários de Sucesso', () => {
    it('deve listar todos os livros do usuário', async () => {
      await authHelper.getAuthenticatedClient();

      // Criar alguns livros
      const book1 = TestDataBuilder.createBook({ title: 'Book 1' });
      const book2 = TestDataBuilder.createBook({ title: 'Book 2' });
      const book3 = TestDataBuilder.createBook({ title: 'Book 3' });

      await apiClient.createBook(book1);
      await apiClient.createBook(book2);
      await apiClient.createBook(book3);

      const response = await apiClient.getBooks();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('books');
      expect(response.body.books).toHaveLength(3);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.total).toBe(3);
    });

    it('deve retornar lista vazia quando usuário não tem livros', async () => {
      await authHelper.getAuthenticatedClient();

      const response = await apiClient.getBooks();

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });

    it('deve retornar apenas livros do usuário autenticado', async () => {
      // Garantir limpeza total antes deste teste
      await cleanupTestDatabase();
      
      // Usuário 1 cria 2 livros
      const client1 = await authHelper.getAuthenticatedClient();
      await client1.createBook(TestDataBuilder.createBook());
      await client1.createBook(TestDataBuilder.createBook());
    
      // Usuário 2 cria 3 livros
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
      await client2.createBook(TestDataBuilder.createBook());
      await client2.createBook(TestDataBuilder.createBook());
      await client2.createBook(TestDataBuilder.createBook());
    
      // Usuário 1 deve ver apenas seus 2 livros
      const response1 = await client1.getBooks();
      expect(response1.body.books).toHaveLength(2);
    
      // Usuário 2 deve ver apenas seus 3 livros
      const response2 = await client2.getBooks();
      expect(response2.body.books).toHaveLength(3);
    });
  });

  describe('Cenários de Paginação', () => {
    beforeEach(async () => {
      await authHelper.getAuthenticatedClient();

      // Criar 15 livros
      for (let i = 1; i <= 15; i++) {
        await apiClient.createBook(TestDataBuilder.createBook({ title: `Book ${i}` }));
      }
    });

    it('deve retornar 10 livros por padrão (página 1)', async () => {
      const response = await apiClient.getBooks();

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(10);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(15);
      expect(response.body.pagination.totalPages).toBe(2);
    });

    it('deve retornar livros da página 2', async () => {
      const response = await apiClient.getBooks({ page: 2 });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(5);
      expect(response.body.pagination.page).toBe(2);
    });

    it('deve respeitar limite customizado', async () => {
      const response = await apiClient.getBooks({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(5);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.pagination.totalPages).toBe(3);
    });

    it('deve combinar página e limite', async () => {
      const response = await apiClient.getBooks({ page: 2, limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(5);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('Cenários de Filtros', () => {
    beforeEach(async () => {
      await authHelper.getAuthenticatedClient();

      // Criar livros com diferentes status
      await apiClient.createBook(TestDataBuilder.createBook({ title: 'To Read Book' }));
      
      const readingBook = await apiClient.createBook(TestDataBuilder.createBook({ title: 'Reading Book' }));
      await apiClient.updateBookStatus(readingBook.body.book.id, 'reading');

      const readBook = await apiClient.createBook(TestDataBuilder.createBook({ title: 'Read Book' }));
      await apiClient.updateBookStatus(readBook.body.book.id, 'read');
      await apiClient.updateBook(readBook.body.book.id, { rating: 5 });
    });

    it('deve filtrar por status "to_read"', async () => {
      const response = await apiClient.getBooks({ status: 'to_read' });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].status).toBe('to_read');
    });

    it('deve filtrar por status "reading"', async () => {
      const response = await apiClient.getBooks({ status: 'reading' });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].status).toBe('reading');
    });

    it('deve filtrar por status "read"', async () => {
      const response = await apiClient.getBooks({ status: 'read' });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].status).toBe('read');
    });

    it('deve filtrar por rating', async () => {
      const response = await apiClient.getBooks({ rating: 5 });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].rating).toBe(5);
    });

    it('deve buscar por título (case-insensitive)', async () => {
      const response = await apiClient.getBooks({ title: 'reading' });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].title).toContain('Reading');
    });

    it('deve buscar por autor (case-insensitive)', async () => {
      await apiClient.createBook(TestDataBuilder.createBook({ author: 'Robert Martin' }));

      const response = await apiClient.getBooks({ author: 'martin' });

      expect(response.status).toBe(200);
      expect(response.body.books.length).toBeGreaterThan(0);
      expect(response.body.books[0].author).toMatch(/martin/i);
    });

    it('deve combinar múltiplos filtros', async () => {
      const response = await apiClient.getBooks({ 
        status: 'read',
        rating: 5
      });

      expect(response.status).toBe(200);
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].status).toBe('read');
      expect(response.body.books[0].rating).toBe(5);
    });
  });

  describe('Cenários de Ordenação', () => {
    beforeEach(async () => {
      await authHelper.getAuthenticatedClient();

      await apiClient.createBook(TestDataBuilder.createBook({ title: 'Zebra Book' }));
      await apiClient.createBook(TestDataBuilder.createBook({ title: 'Alpha Book' }));
      await apiClient.createBook(TestDataBuilder.createBook({ title: 'Beta Book' }));
    });

    it('deve ordenar por título crescente (ASC)', async () => {
      const response = await apiClient.getBooks({ 
        sortBy: 'title',
        sortOrder: 'ASC'
      });

      expect(response.status).toBe(200);
      expect(response.body.books[0].title).toBe('Alpha Book');
      expect(response.body.books[1].title).toBe('Beta Book');
      expect(response.body.books[2].title).toBe('Zebra Book');
    });

    it('deve ordenar por título decrescente (DESC)', async () => {
      const response = await apiClient.getBooks({ 
        sortBy: 'title',
        sortOrder: 'DESC'
      });

      expect(response.status).toBe(200);
      expect(response.body.books[0].title).toBe('Zebra Book');
      expect(response.body.books[1].title).toBe('Beta Book');
      expect(response.body.books[2].title).toBe('Alpha Book');
    });

    it('deve ordenar por data de criação por padrão (mais recentes primeiro)', async () => {
      const response = await apiClient.getBooks();

      expect(response.status).toBe(200);
      const dates = response.body.books.map((b: any) => new Date(b.createdAt).getTime());
      
      // Verificar que está ordenado do mais recente para o mais antigo
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });
  });

  describe('Cenários de Autorização', () => {
    it('deve retornar erro 401 quando não enviar token', async () => {
      const response = await apiClient.getBooks();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('deve retornar erro 401 quando enviar token inválido', async () => {
      apiClient.setToken('token-invalido');

      const response = await apiClient.getBooks();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});