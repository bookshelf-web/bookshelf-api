const BASE = {
  NODE_ENV: 'test',
  JWT_SECRET: 'a-secret-that-is-at-least-32-characters-long',
  DB_HOST: 'localhost',
  DB_USER: 'u',
  DB_PASSWORD: 'p',
  DB_NAME: 'n',
};

type EnvModule = typeof import('../../../src/config/env');

/** Loads src/config/env.ts against a fresh, fully controlled process.env. */
function loadEnv(overrides: Record<string, string | undefined> = {}, base: Record<string, string> = BASE): EnvModule {
  const original = process.env;
  process.env = { ...base } as NodeJS.ProcessEnv;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    let loaded: EnvModule | undefined;
    jest.isolateModules(() => {
      // dotenv must not pull a developer's local .env into the test.
      jest.doMock('dotenv', () => ({ __esModule: true, default: { config: () => ({}) } }));
      loaded = require('../../../src/config/env');
    });
    return loaded as EnvModule;
  } finally {
    process.env = original;
  }
}

describe('env', () => {
  let exit: jest.SpyInstance;
  let error: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    exit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies defaults', () => {
    const { env } = loadEnv();

    expect(env).toMatchObject({ PORT: 3000, JWT_EXPIRES_IN: '7d', LOG_LEVEL: 'info' });
    expect(env.corsOrigins).toEqual(
      expect.arrayContaining(['http://localhost:3000', 'http://localhost:5173', 'http://frontend:5173']),
    );
    expect(env.adminEmails).toEqual([]);
  });

  it('splits and normalises CORS_ORIGIN and ADMIN_EMAILS', () => {
    const { env } = loadEnv({
      CORS_ORIGIN: ' https://a.test , https://b.test ',
      ADMIN_EMAILS: ' Admin@X.com,, boss@y.com ',
    });

    expect(env.corsOrigins).toEqual(['https://a.test', 'https://b.test']);
    expect(env.adminEmails).toEqual(['admin@x.com', 'boss@y.com']);
  });

  it('coerces numeric variables', () => {
    const { env } = loadEnv({ PORT: '8080', DB_PORT: '6543' });

    expect(env.PORT).toBe(8080);
    expect(env.DB_PORT).toBe(6543);
  });

  it('accepts DATABASE_URL instead of the DB_* variables', () => {
    const { env } = loadEnv(
      {},
      { NODE_ENV: 'test', JWT_SECRET: BASE.JWT_SECRET, DATABASE_URL: 'postgresql://u:p@host:5432/db' },
    );

    expect(env.DATABASE_URL).toBe('postgresql://u:p@host:5432/db');
  });

  it('exits and names every missing database variable', () => {
    expect(() => loadEnv({}, { NODE_ENV: 'test', JWT_SECRET: BASE.JWT_SECRET })).toThrow('process.exit');

    expect(exit).toHaveBeenCalledWith(1);
    const output = error.mock.calls.map(call => String(call[0])).join('\n');
    expect(output).toContain('DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
  });

  it('exits without a JWT secret', () => {
    expect(() => loadEnv({ JWT_SECRET: undefined })).toThrow('process.exit');

    expect(error.mock.calls.map(call => String(call[0])).join('\n')).toContain('JWT_SECRET');
  });

  it.each([
    ['NODE_ENV', 'staging'],
    ['LOG_LEVEL', 'verbose'],
    ['DATABASE_URL', 'not a url'],
    ['PORT', '-1'],
  ])('exits on an invalid %s', (key, value) => {
    expect(() => loadEnv({ [key]: value, DATABASE_URL: key === 'DATABASE_URL' ? value : undefined })).toThrow(
      'process.exit',
    );
  });

  it('enables simulated payments outside production, and in production only when opted in', () => {
    expect(loadEnv().env.simulatedPaymentsEnabled).toBe(true);
    expect(loadEnv({ NODE_ENV: 'production' }).env.simulatedPaymentsEnabled).toBe(false);
    expect(
      loadEnv({ NODE_ENV: 'production', ALLOW_SIMULATED_PAYMENTS: 'true' }).env.simulatedPaymentsEnabled,
    ).toBe(true);
  });

  it('warns about a short JWT secret in production only', () => {
    loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'short' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));

    warn.mockClear();
    loadEnv({ NODE_ENV: 'test', JWT_SECRET: 'short' });
    expect(warn).not.toHaveBeenCalled();
  });
});
