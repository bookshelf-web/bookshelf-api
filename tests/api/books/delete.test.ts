import { ApiClient } from '../../helpers/apiClient';
import { AuthHelper } from '../../helpers/authHelper';
import { TestDataBuilder } from '../../helpers/testDataBuilder';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase';

describe('DELETE /api/books/:id', () => {
  let apiClient: ApiClient;
  let authHelper: AuthHelper;
  let bookId: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    apiClient = new ApiClient();
    authHelper = new AuthHelper(apiClient);
    await cleanupTestDatabase();

    // Criar um livro para cada teste
    await authHelper.getAuthenticatedClient();
    const createResponse = await apiClient.createBook(TestDataBuilder.createBook());
    bookId = createResponse.body.book.id;
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Cenários de Sucesso', () => {
    it('deve deletar livro existente', async () => {
      const response = await apiClient.deleteBook(bookId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Livro removido com sucesso');
    });

    it('livro deletado não deve mais existir', async () => {
      // Deletar livro
      await apiClient.deleteBook(bookId);

      // Tentar buscar livro deletado
      const getResponse = await apiClient.getBookById(bookId);

      expect(getResponse.status).toBe(404);
      expect(getResponse.body).toHaveProperty('error');
    });

    it('livro deletado não deve aparecer na listagem', async () => {
      // Criar mais livros
      await apiClient.createBook(TestDataBuilder.createBook());
      await apiClient.createBook(TestDataBuilder.createBook());

      // Verificar que tem 3 livros
      let listResponse = await apiClient.getBooks();
      expect(listResponse.body.books).toHaveLength(3);

      // Deletar um livro
      await apiClient.deleteBook(bookId);

      // Verificar que agora tem apenas 2
      listResponse = await apiClient.getBooks();
      expect(listResponse.body.books).toHaveLength(2);
      
      // Verificar que o livro deletado não está na lista
      const deletedBookStillExists = listResponse.body.books.some((b: any) => b.id === bookId);
      expect(deletedBookStillExists).toBe(false);
    });

    it('deve poder deletar múltiplos livros', async () => {
      const book2 = await apiClient.createBook(TestDataBuilder.createBook());
      const book3 = await apiClient.createBook(TestDataBuilder.createBook());

      // Deletar todos
      await apiClient.deleteBook(bookId);
      await apiClient.deleteBook(book2.body.book.id);
      await apiClient.deleteBook(book3.body.book.id);

      // Verificar que lista está vazia
      const listResponse = await apiClient.getBooks();
      expect(listResponse.body.books).toHaveLength(0);
    });
  });

  describe('Cenários de Erro', () => {
    it('deve retornar erro 404 quando livro não existe', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await apiClient.deleteBook(fakeId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/não encontrado/i);
    });

    it('deve retornar erro 404 ao tentar deletar livro já deletado', async () => {
      // Deletar livro
      await apiClient.deleteBook(bookId);

      // Tentar deletar novamente
      const response = await apiClient.deleteBook(bookId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('deve retornar erro 404 quando tentar deletar livro de outro usuário', async () => {
      // Usuário 2 tenta deletar livro do usuário 1
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
      
      const response = await client2.deleteBook(bookId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Cenários de Isolamento de Usuários', () => {
    it('deletar livro de um usuário não deve afetar livros de outro', async () => {
      // Usuário 2 cria livros
      const client2 = await authHelper.getAuthenticatedClient(TestDataBuilder.createUser());
      await client2.createBook(TestDataBuilder.createBook());
      await client2.createBook(TestDataBuilder.createBook());

      // Usuário 1 deleta seu livro
      await apiClient.deleteBook(bookId);

      // Usuário 2 ainda deve ter seus 2 livros
      const user2Books = await client2.getBooks();
      expect(user2Books.body.books).toHaveLength(2);
    });
  });

  describe('Cenários de Autorização', () => {
    it('deve retornar erro 401 quando não enviar token', async () => {
      apiClient.clearToken();

      const response = await apiClient.deleteBook(bookId);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('deve retornar erro 401 quando enviar token inválido', async () => {
      apiClient.setToken('token-invalido');

      const response = await apiClient.deleteBook(bookId);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Cenários de Permanência de Dados', () => {
    it('após deletar livro ISBN deve poder ser reutilizado', async () => {
      const bookData = await apiClient.getBookById(bookId);
      const isbn = bookData.body.book.isbn;

      // Deletar livro
      await apiClient.deleteBook(bookId);

      // Criar novo livro com mesmo ISBN
      const newBook = TestDataBuilder.createBook({ isbn });
      const response = await apiClient.createBook(newBook);

      expect(response.status).toBe(201);
      expect(response.body.book.isbn).toBe(isbn);
    });
  });
});