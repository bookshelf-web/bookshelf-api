import express from 'express';
import request from 'supertest';
import { requestLogger, withContext } from '../../../src/shared/requestContext';

function buildApp() {
  const app = express();
  app.use(requestLogger);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/library/ping', withContext('library'), (req, res) =>
    res.json({ id: String(req.id), context: res.locals.context }),
  );
  app.get('/plain', (req, res) => res.json({ id: String(req.id), context: res.locals.context ?? null }));
  return app;
}

describe('requestLogger', () => {
  it('generates a request id and echoes it in the X-Request-Id header', async () => {
    const response = await request(buildApp()).get('/plain');

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body.id).toBe(response.headers['x-request-id']);
  });

  it('reuses a well-formed id sent by an upstream proxy', async () => {
    const response = await request(buildApp()).get('/plain').set('X-Request-Id', 'proxy-request-12345');

    expect(response.headers['x-request-id']).toBe('proxy-request-12345');
  });

  it.each(['short', 'has spaces in it!!', 'x'.repeat(80), '<script>alert(1)</script>'])(
    'replaces the unsafe id %p with a generated one',
    async incoming => {
      const response = await request(buildApp()).get('/plain').set('X-Request-Id', incoming);

      expect(response.headers['x-request-id']).not.toBe(incoming);
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it('does not break the health check', async () => {
    const response = await request(buildApp()).get('/health');

    expect(response.status).toBe(200);
  });
});

describe('withContext', () => {
  it('tags the request with its bounded context', async () => {
    const response = await request(buildApp()).get('/library/ping');

    expect(response.body.context).toBe('library');
  });

  it('leaves untagged routes without a context', async () => {
    const response = await request(buildApp()).get('/plain');

    expect(response.body.context).toBeNull();
  });
});
