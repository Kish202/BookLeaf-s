import { query } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';

const BOOK_SELECT = `
  SELECT b.*, u.name AS author_name
  FROM books b
  JOIN authors a ON a.id = b.author_id
  JOIN users u ON u.id = a.user_id
`;

export function toBook(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    title: row.title,
    isbn: row.isbn,
    genre: row.genre,
    status: row.status,
    isPublished: row.status === 'Published & Live',
    publicationDate: row.publication_date,
    mrp: row.mrp,
    authorRoyaltyPerCopy: row.author_royalty_per_copy,
    totalCopiesSold: row.total_copies_sold,
    totalRoyaltyEarned: row.total_royalty_earned,
    royaltyPaid: row.royalty_paid,
    royaltyPending: row.royalty_pending,
    lastRoyaltyPayoutDate: row.last_royalty_payout_date,
    printPartner: row.print_partner,
    availableOn: row.available_on,
  };
}

function summarize(books) {
  return books.reduce(
    (totals, book) => ({
      totalBooks: totals.totalBooks + 1,
      publishedBooks: totals.publishedBooks + (book.isPublished ? 1 : 0),
      totalCopiesSold: totals.totalCopiesSold + book.totalCopiesSold,
      totalRoyaltyEarned: totals.totalRoyaltyEarned + book.totalRoyaltyEarned,
      royaltyPaid: totals.royaltyPaid + book.royaltyPaid,
      royaltyPending: totals.royaltyPending + book.royaltyPending,
    }),
    { totalBooks: 0, publishedBooks: 0, totalCopiesSold: 0, totalRoyaltyEarned: 0, royaltyPaid: 0, royaltyPending: 0 },
  );
}

export async function listBooks(user, { authorId } = {}) {
  const scopedAuthorId = user.role === 'author' ? user.authorId : authorId;
  const params = [];
  let where = '';
  if (scopedAuthorId) {
    params.push(scopedAuthorId);
    where = 'WHERE b.author_id = $1';
  }

  const { rows } = await query(
    `${BOOK_SELECT} ${where}
     ORDER BY b.publication_date DESC NULLS FIRST, b.title`,
    params,
  );
  const books = rows.map(toBook);
  return { data: books, summary: summarize(books) };
}

export async function getBook(user, bookId) {
  const { rows } = await query(`${BOOK_SELECT} WHERE b.id = $1`, [bookId]);
  const row = rows[0];
  // Authors get 404 (not 403) for other authors' books so ids cannot be probed.
  if (!row || (user.role === 'author' && row.author_id !== user.authorId)) {
    throw AppError.notFound('Book');
  }
  return toBook(row);
}

export async function assertBookBelongsToAuthor(bookId, authorId) {
  const { rowCount } = await query('SELECT 1 FROM books WHERE id = $1 AND author_id = $2', [bookId, authorId]);
  if (rowCount === 0) {
    throw AppError.validation([
      { location: 'body', field: 'bookId', message: 'Selected book does not belong to your account' },
    ]);
  }
}
