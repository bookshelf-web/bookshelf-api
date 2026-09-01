import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://frontend:5173',
];

const booleanString = z.enum(['true', 'false']).transform(value => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    // Hosted providers (Supabase/Render) expose a single connection URL and require SSL.
    DATABASE_URL: z.string().url().optional(),
    DB_HOST: z.string().optional(),
    DB_PORT: z.coerce.number().int().positive().optional(),
    DB_USER: z.string().optional(),
    DB_PASSWORD: z.string().optional(),
    DB_NAME: z.string().optional(),
    DB_SYNC: booleanString.default('false'),

    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    CORS_ORIGIN: z.string().optional(),
  })
  .transform(raw => ({
    ...raw,
    corsOrigins: raw.CORS_ORIGIN
      ? raw.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : DEFAULT_CORS_ORIGINS,
  }))
  .superRefine((data, ctx) => {
    if (!data.DATABASE_URL) {
      const missing = (['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const).filter(
        key => !data[key],
      );
      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing database configuration: ${missing.join(', ')} (or set DATABASE_URL)`,
        });
      }
    }
  });

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.') || 'env'}: ${issue.message}`);
    }
    process.exit(1);
  }

  if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET.length < 32) {
    console.warn('WARNING: JWT_SECRET should be at least 32 characters long in production');
  }

  return parsed.data;
}

export const env = loadEnv();

export type Env = typeof env;
