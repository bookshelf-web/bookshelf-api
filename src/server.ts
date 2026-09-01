import app from './app';
import { env } from './config/env';
import { initializeDatabase } from './config/database';

async function startServer(): Promise<void> {
  await initializeDatabase();

  app.listen(env.PORT, () => {
    console.log(`BookShelf API running on port ${env.PORT} (${env.NODE_ENV})`);
    console.log(`Docs: http://localhost:${env.PORT}/api-docs`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
