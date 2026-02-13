import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Variáveis obrigatórias
const requiredEnvVars = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
];

// Validar variáveis obrigatórias
export function validateEnv(): void {
  const missing: string[] = [];

  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  });

  if (missing.length > 0) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => {
      console.error(`   - ${envVar}`);
    });
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Please check your .env file and try again.');
    process.exit(1);
  }
}

// Validar JWT_SECRET especificamente
export function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET must be defined in environment variables');
  }

  if (secret.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters long for production');
  }

  return secret;
}

export default {
  validateEnv,
  getJWTSecret,
};