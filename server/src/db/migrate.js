import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';

const schemaUrl = new URL('./schema.sql', import.meta.url);

async function migrate() {
  const sql = await readFile(schemaUrl, 'utf8');
  await pool.query(sql);
  console.log('Schema applied.');
}

migrate()
  .catch((err) => {
    console.error('Schema migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
