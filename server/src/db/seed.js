import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
import { pool, withTransaction } from './pool.js';

const dataUrl = new URL('./data/bookleaf_sample_data.json', import.meta.url);

const ADMINS = [
  { name: 'BookLeaf Support', email: 'admin@bookleaf.com' },
  { name: 'Operations Team', email: 'ops@bookleaf.com' },
];

const BCRYPT_ROUNDS = 10;

async function insertUser(client, { name, email, passwordHash, role }) {
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, lower($2), $3, $4)
     RETURNING id`,
    [name, email, passwordHash, role],
  );
  return rows[0].id;
}

async function insertBook(client, authorId, book) {
  await client.query(
    `INSERT INTO books (
       id, author_id, title, isbn, genre, status, publication_date, mrp,
       author_royalty_per_copy, total_copies_sold, total_royalty_earned,
       royalty_paid, royalty_pending, last_royalty_payout_date, print_partner, available_on
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      book.book_id,
      authorId,
      book.title,
      book.isbn,
      book.genre,
      book.status,
      book.publication_date,
      book.mrp,
      book.author_royalty_per_copy,
      book.total_copies_sold ?? 0,
      book.total_royalty_earned ?? 0,
      book.royalty_paid ?? 0,
      book.royalty_pending ?? 0,
      book.last_royalty_payout_date,
      book.print_partner,
      book.available_on ?? [],
    ],
  );
}

async function seed() {
  const { authors } = JSON.parse(await readFile(dataUrl, 'utf8'));

  const [authorHash, adminHash] = await Promise.all([
    bcrypt.hash(config.seed.authorPassword, BCRYPT_ROUNDS),
    bcrypt.hash(config.seed.adminPassword, BCRYPT_ROUNDS),
  ]);

  const counts = await withTransaction(async (client) => {
    await client.query('TRUNCATE ticket_notes, ticket_messages, tickets, books, authors, users RESTART IDENTITY CASCADE');

    for (const admin of ADMINS) {
      await insertUser(client, { ...admin, passwordHash: adminHash, role: 'admin' });
    }

    let bookCount = 0;
    for (const author of authors) {
      const userId = await insertUser(client, {
        name: author.name,
        email: author.email,
        passwordHash: authorHash,
        role: 'author',
      });

      await client.query(
        `INSERT INTO authors (id, user_id, phone, city, joined_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [author.author_id, userId, author.phone, author.city, author.joined_date],
      );

      for (const book of author.books) {
        await insertBook(client, author.author_id, book);
        bookCount += 1;
      }
    }

    return { admins: ADMINS.length, authors: authors.length, books: bookCount };
  });

  console.log(`Seeded ${counts.admins} admins, ${counts.authors} authors, ${counts.books} books.`);
}

seed()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
