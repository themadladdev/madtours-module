// server/src/config/environment.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Environment-Specific Loading ---
const env = process.env.NODE_ENV;

if (!env) {
  throw new Error('FATAL ERROR: NODE_ENV is not set. Start the server with "npm run dev"');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..'); 
const envPath = path.resolve(rootDir, `.env.${env}`);

const result = dotenv.config({ path: envPath });

if (result.error) {
  throw new Error(`FATAL ERROR: Could not parse ${envPath} file. ${result.error.message}`);
}
// --- End Loading ---

// --- UPGRADED VALIDATION (Based on your working example) ---
const requiredEnvVars = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  
  // Stripe (from prototype)
  STRIPE_SECRET_KEY_DEV: process.env.STRIPE_SECRET_KEY_DEV,
  STRIPE_WEBHOOK_SECRET_DEV: process.env.STRIPE_WEBHOOK_SECRET_DEV,
  
  // Email (from your .env file)
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_SECURE: process.env.EMAIL_SECURE,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  FROM_EMAIL: process.env.FROM_EMAIL,
};

// Conditionally check for DB_URL or broken-out vars
if (process.env.DATABASE_URL) {
  requiredEnvVars.DATABASE_URL = process.env.DATABASE_URL;
} else {
  requiredEnvVars.DB_HOST = process.env.DB_HOST;
  requiredEnvVars.DB_PORT = process.env.DB_PORT;
  requiredEnvVars.DB_NAME = process.env.DB_NAME;
  requiredEnvVars.DB_USER = process.env.DB_USER;
  requiredEnvVars.DB_PASSWORD = process.env.DB_PASSWORD;
}

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// --- UPGRADED EXPORT (Based on your working example) ---
export const config = {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT || 5000,
  corsOrigins: process.env.CORS_ORIGINS.split(','),
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  databaseUrl: process.env.DATABASE_URL, // Will be undefined if not set, which is fine
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD || ''),
  },
  
  stripeSecretKey: process.env.STRIPE_SECRET_KEY_DEV,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET_DEV,

  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.FROM_EMAIL,
  }
};