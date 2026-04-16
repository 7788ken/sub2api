import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const pool = new pg.Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'sub2api',
    password: process.env.DB_PASSWORD || 'sub2api',
    database: process.env.DB_NAME || 'sub2api',
  });

  const sql = readFileSync(join(__dirname, 'init.sql'), 'utf-8');
  console.log('[db:init] Running init.sql...');
  await pool.query(sql);
  console.log('[db:init] Tables created successfully.');
  await pool.end();
}

main().catch((err) => {
  console.error('[db:init] Failed:', err);
  process.exit(1);
});
