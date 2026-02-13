export class TestDataBuilder {
    static generateUniqueEmail(): string {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      return `test.${timestamp}.${random}@test.com`;
    }
  
    static generateUniqueISBN(): string {
      const random = Math.floor(Math.random() * 10000000000);
      return `978${random}`.substring(0, 13);
    }
  
    static createUser(overrides?: any) {
      return {
        name: 'Test User',
        email: this.generateUniqueEmail(),
        password: 'senha123',
        ...overrides,
      };
    }
  
    static createBook(overrides?: any) {
      return {
        title: 'Test Book',
        author: 'Test Author',
        isbn: this.generateUniqueISBN(),
        pages: 300,
        publishedYear: 2020,
        ...overrides,
      };
    }
  }