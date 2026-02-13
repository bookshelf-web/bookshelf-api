import { AppDataSource } from '../../src/config/database';

export const setupTestDatabase = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ Test database connected');
    }
  } catch (error) {
    console.error('❌ Error connecting to test database:', error);
    throw error;
  }
};

export const cleanupTestDatabase = async (): Promise<void> => {
  try {
    if (AppDataSource.isInitialized) {
      // Aguardar qualquer transação pendente
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Usar TRUNCATE com CASCADE e RESTART IDENTITY
      await AppDataSource.query('TRUNCATE TABLE books RESTART IDENTITY CASCADE');
      await AppDataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
      
      // Aguardar para garantir que o truncate foi commitado
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } catch (error) {
    console.error('❌ Error cleaning test database:', error);
    throw error;
  }
};

export const closeTestDatabase = async (): Promise<void> => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✅ Test database connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing test database:', error);
  }
};