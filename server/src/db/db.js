// server/src/db/db.js
import pg from 'pg';
import { config } from '../config/environment.js';

// --- UPGRADED DB CONNECTION (Based on your working example) ---
// Use broken-out vars if they exist, otherwise use the connection string
const connectionConfig = config.db.host 
  ? {
      user: config.db.user,
      host: config.db.host,
      database: config.db.database,
      password: config.db.password,
      port: config.db.port,
    }
  : {
      connectionString: config.databaseUrl,
    };

export const pool = new pg.Pool({
  ...connectionConfig,
  ssl: config.isDevelopment ? false : { rejectUnauthorized: false },
});

pool.on('connect', () => {
  console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err.message);
});