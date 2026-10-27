import { query } from '../db/pool.js';

export async function listAdmins() {
  const { rows } = await query("SELECT id, name, email FROM users WHERE role = 'admin' ORDER BY name");
  return rows;
}
