import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';

// Compared against when the email is unknown, so response time does not reveal
// which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.role, u.password_hash, a.id AS author_id
  FROM users u
  LEFT JOIN authors a ON a.user_id = u.id
`;

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    authorId: row.author_id ?? null,
  };
}

function signToken(user) {
  return jwt.sign({ role: user.role, authorId: user.authorId }, config.jwt.secret, {
    subject: String(user.id),
    expiresIn: config.jwt.expiresIn,
  });
}

export async function login(email, password) {
  const { rows } = await query(`${USER_SELECT} WHERE lower(u.email) = $1`, [email]);
  const row = rows[0];

  const passwordMatches = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !passwordMatches) {
    throw AppError.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  }

  const user = toPublicUser(row);
  return { token: signToken(user), user };
}

export async function getUserById(id) {
  const { rows } = await query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  if (!rows[0]) throw AppError.notFound('User');
  return toPublicUser(rows[0]);
}
