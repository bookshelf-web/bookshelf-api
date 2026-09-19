// Runs before any module is loaded, so src/config/env.ts sees these values.
// Defaults let the unit tests (which never open a connection) run without a database.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-that-is-at-least-32-characters';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.DB_NAME = process.env.DB_NAME || 'bookshelf_test';
process.env.ADMIN_EMAILS = process.env.ADMIN_EMAILS || 'admin@bookshelf.test';
