import pg from 'pg';
import { config } from '../config/env.js';

const NUMERIC_OID = 1700;
const DATE_OID = 1082;

// pg returns NUMERIC as strings to avoid precision loss; our money values are
// well within float range, so numbers are friendlier for the API.
pg.types.setTypeParser(NUMERIC_OID, (value) => (value === null ? null : parseFloat(value)));
// Keep DATE columns as 'YYYY-MM-DD' strings so they are not shifted by the server timezone.
pg.types.setTypeParser(DATE_OID, (value) => value);

export const pool = new pg.Pool({
  connectionString: config.db.url,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
