import app from './app';
import { env } from './config/env';
import { initializeDatabase } from './config/database';
import { contextLogger } from './shared/logger';

const log = contextLogger('platform');

async function startServer(): Promise<void> {
  await initializeDatabase();

  app.listen(env.PORT, () => {
    log.info({ port: env.PORT, env: env.NODE_ENV }, 'BookShelf API running');
    log.info(`Docs: http://localhost:${env.PORT}/api-docs`);
  });
}

startServer().catch(error => {
  log.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
