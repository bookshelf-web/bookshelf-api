export class TestDataBuilder {
  static generateUniqueEmail(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `test.${timestamp}.${random}@test.com`;
  }

  /** A random but valid ISBN-13 (the API validates the check digit). */
  static generateUniqueISBN(): string {
    const nineDigits = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0');
    const twelve = `978${nineDigits}`;
    const sum = twelve
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    return `${twelve}${(10 - (sum % 10)) % 10}`;
  }

  static createUser(overrides?: any) {
    return {
      name: 'Test User',
      email: this.generateUniqueEmail(),
      password: 'secret123',
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
