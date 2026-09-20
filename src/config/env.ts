import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://frontend:5173',
];

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

    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    CORS_ORIGIN: z.string().optional(),
    // Comma-separated emails that are granted the admin role on register/login.
    ADMIN_EMAILS: z.string().optional(),
    // The only payment gateway is a simulator; production must opt in explicitly (demo deployments only).
    ALLOW_SIMULATED_PAYMENTS: z.enum(['true', 'false']).default('false'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .transform(raw => ({
    ...raw,
    adminEmails: (raw.ADMIN_EMAILS ?? '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
    simulatedPaymentsEnabled: raw.NODE_ENV !== 'production' || raw.ALLOW_SIMULATED_PAYMENTS === 'true',
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
