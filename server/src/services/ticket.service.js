import { classifyByKeywords } from '../ai/keywordClassifier.js';
import { RESOLVED_STATUSES } from '../constants/tickets.js';
import { query, withTransaction } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { generateDraft as aiGenerateDraft, classifyTicket } from './ai.service.js';
import { assertBookBelongsToAuthor, toBook } from './book.service.js';

const TICKET_SELECT = `
  SELECT
    t.*,
    b.title AS book_title,
    au.name AS author_name,
    au.email AS author_email,
    assignee.name AS assignee_name,
    (SELECT count(*)::int FROM ticket_messages m WHERE m.ticket_id = t.id) AS message_count,
    (SELECT max(m.created_at) FROM ticket_messages m WHERE m.ticket_id = t.id) AS last_message_at
  FROM tickets t
  JOIN authors a ON a.id = t.author_id
  JOIN users au ON au.id = a.user_id
  LEFT JOIN books b ON b.id = t.book_id
  LEFT JOIN users assignee ON assignee.id = t.assigned_to
`;

const PRIORITY_RANK = `
  CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END
`;

const SORTS = {
  // Unresolved first, then most urgent, then oldest waiting.
  urgency: `CASE WHEN t.status IN ('open', 'in_progress') THEN 0 ELSE 1 END, ${PRIORITY_RANK}, t.created_at ASC`,
  newest: 't.created_at DESC',
  oldest: 't.created_at ASC',
  updated: 't.updated_at DESC',
};

function toTicket(row, role) {
  const ticket = {
    id: row.id,
    subject: row.subject,
    description: row.description,
    attachmentName: row.attachment_name,
    status: row.status,
    book: row.book_id ? { id: row.book_id, title: row.book_title } : null,
    messageCount: row.message_count,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };

  if (role === 'author') return ticket;

  return {
    ...ticket,
    author: { id: row.author_id, name: row.author_name, email: row.author_email },
    category: row.category,
    categorySource: row.category_source,
    priority: row.priority,
    prioritySource: row.priority_source,
    aiReasoning: row.ai_reasoning,
    hasAiDraft: row.ai_draft !== null,
    assignedTo: row.assigned_to ? { id: row.assigned_to, name: row.assignee_name } : null,
  };
}

function toMessage(row) {
  return {
    id: row.id,
    body: row.body,
    sender: { id: row.sender_id, name: row.sender_name, role: row.sender_role },
    aiAssisted: row.ai_assisted,
    createdAt: row.created_at,
  };
}

function toNote(row) {
  return {
    id: row.id,
    body: row.body,
    admin: { id: row.admin_id, name: row.admin_name },
    createdAt: row.created_at,
  };
}

function canAccess(user, ticketRow) {
  return user.role === 'admin' || ticketRow.author_id === user.authorId;
}

function buildListFilters(user, filters) {
  const conditions = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    conditions.push(sql.replaceAll('?', `$${params.length}`));
  };

  if (user.role === 'author') {
    add('t.author_id = ?', user.authorId);
  }
  if (filters.status) add('t.status = ANY(?)', filters.status);
  if (filters.from) add('t.created_at >= ?::date', filters.from);
  if (filters.to) add("t.created_at < ?::date + interval '1 day'", filters.to);

  if (user.role === 'admin') {
    if (filters.category) add('t.category = ANY(?)', filters.category);
    if (filters.priority) add('t.priority = ANY(?)', filters.priority);
    if (filters.assignedTo === 'unassigned') conditions.push('t.assigned_to IS NULL');
    else if (filters.assignedTo === 'me') add('t.assigned_to = ?', user.id);
    else if (filters.assignedTo) add('t.assigned_to = ?', filters.assignedTo);
    if (filters.search) {
      add('(t.subject ILIKE ? OR t.description ILIKE ? OR au.name ILIKE ?)', `%${filters.search}%`);
    }
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export async function listTickets(user, filters) {
  const { where, params } = buildListFilters(user, filters);
  // Urgency ordering is an ops concept; authors see their most recently active tickets first.
  const sort = user.role === 'author' && filters.sort === 'urgency' ? 'updated' : filters.sort;
  const offset = (filters.page - 1) * filters.pageSize;

  const { rows } = await query(
    `SELECT *, count(*) OVER()::int AS total_count
     FROM (${TICKET_SELECT} ${where}) t
     ORDER BY ${SORTS[sort]}, t.id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.pageSize, offset],
  );

  return {
    data: rows.map((row) => toTicket(row, user.role)),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: rows[0]?.total_count ?? 0,
    },
  };
}

async function findTicketRow(user, ticketId) {
  const { rows } = await query(`${TICKET_SELECT} WHERE t.id = $1`, [ticketId]);
  const row = rows[0];
  // 404 rather than 403 so authors cannot discover other authors' ticket ids.
  if (!row || !canAccess(user, row)) throw AppError.notFound('Ticket');
  return row;
}

export async function getTicket(user, ticketId) {
  const row = await findTicketRow(user, ticketId);

  const messagesPromise = query(
    `SELECT m.*, u.name AS sender_name, u.role AS sender_role
     FROM ticket_messages m JOIN users u ON u.id = m.sender_id
     WHERE m.ticket_id = $1 ORDER BY m.created_at, m.id`,
    [ticketId],
  );

  if (user.role === 'author') {
    const { rows: messages } = await messagesPromise;
    return { ...toTicket(row, 'author'), messages: messages.map(toMessage) };
  }

  const [{ rows: messages }, { rows: notes }, bookResult] = await Promise.all([
    messagesPromise,
    query(
      `SELECT n.*, u.name AS admin_name
       FROM ticket_notes n JOIN users u ON u.id = n.admin_id
       WHERE n.ticket_id = $1 ORDER BY n.created_at, n.id`,
      [ticketId],
    ),
    row.book_id
      ? query(
          `SELECT b.*, u.name AS author_name FROM books b
           JOIN authors a ON a.id = b.author_id JOIN users u ON u.id = a.user_id
           WHERE b.id = $1`,
          [row.book_id],
        )
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    ...toTicket(row, 'admin'),
    book: bookResult.rows[0] ? toBook(bookResult.rows[0]) : null,
    aiDraft: row.ai_draft,
    aiDraftGeneratedAt: row.ai_draft_generated_at,
    messages: messages.map(toMessage),
    notes: notes.map(toNote),
  };
}

export async function createTicket(user, input) {
  if (input.bookId) {
    await assertBookBelongsToAuthor(input.bookId, user.authorId);
  }

  // Keyword triage is instant, so the ticket is never unclassified in the queue
  // and still gets a sensible category if the LLM is down.
  const triage = classifyByKeywords(input.subject, input.description);
  const { rows } = await query(
    `INSERT INTO tickets (author_id, book_id, subject, description, attachment_name,
                          category, category_source, priority, priority_source, ai_reasoning)
     VALUES ($1, $2, $3, $4, $5, $6, 'fallback', $7, 'fallback', $8)
     RETURNING id`,
    [
      user.authorId,
      input.bookId,
      input.subject,
      input.description,
      input.attachmentName,
      triage.category,
      triage.priority,
      triage.reasoning,
    ],
  );
  const ticketId = rows[0].id;

  // The author does not wait on the LLM; it refines the triage in the background.
  classifyTicket(ticketId).catch((err) => console.error(`Background classification failed for ${ticketId}`, err));

  return getTicket(user, ticketId);
}

/**
 * Status side effects of a new message:
 *  - an admin replying to an `open` ticket moves it to `in_progress` and, if
 *    nobody owns it yet, assigns it to that admin;
 *  - an author replying to a `resolved` ticket reopens it;
 *  - authors cannot reply to `closed` tickets.
 */
export async function addMessage(user, ticketId, { body, aiAssisted }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id, author_id, status, assigned_to FROM tickets WHERE id = $1 FOR UPDATE',
      [ticketId],
    );
    const ticket = rows[0];
    if (!ticket || !canAccess(user, ticket)) throw AppError.notFound('Ticket');

    const isAdmin = user.role === 'admin';
    if (!isAdmin && ticket.status === 'closed') {
      throw AppError.conflict('This ticket is closed. Please raise a new ticket if you still need help.');
    }

    let nextStatus = ticket.status;
    if (isAdmin && ticket.status === 'open') nextStatus = 'in_progress';
    if (!isAdmin && ticket.status === 'resolved') nextStatus = 'open';

    const { rows: inserted } = await client.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, body, ai_assisted)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [ticketId, user.id, body, isAdmin && aiAssisted],
    );

    // Any new message makes the cached draft stale.
    await client.query(
      `UPDATE tickets
       SET ai_draft = NULL,
           ai_draft_generated_at = NULL,
           status = $2::text,
           resolved_at = CASE WHEN $2::text = ANY($3::text[]) THEN resolved_at ELSE NULL END,
           assigned_to = CASE WHEN $4::int IS NOT NULL THEN COALESCE(assigned_to, $4::int) ELSE assigned_to END
       WHERE id = $1`,
      [ticketId, nextStatus, RESOLVED_STATUSES, isAdmin ? user.id : null],
    );

    const { rows: messageRows } = await client.query(
      `SELECT m.*, u.name AS sender_name, u.role AS sender_role
       FROM ticket_messages m JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1`,
      [inserted[0].id],
    );

    return { message: toMessage(messageRows[0]), ticketStatus: nextStatus };
  });
}

async function assertIsAdminUser(userId) {
  const { rowCount } = await query("SELECT 1 FROM users WHERE id = $1 AND role = 'admin'", [userId]);
  if (rowCount === 0) {
    throw AppError.validation([
      { location: 'body', field: 'assignedTo', message: 'Tickets can only be assigned to admin users' },
    ]);
  }
}

export async function updateTicket(admin, ticketId, changes) {
  if (changes.assignedTo != null) {
    await assertIsAdminUser(changes.assignedTo);
  }

  const sets = [];
  const params = [ticketId];
  const param = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (changes.status !== undefined) {
    const status = param(changes.status);
    const resolved = param(RESOLVED_STATUSES);
    sets.push(`status = ${status}::text`);
    sets.push(
      `resolved_at = CASE WHEN ${status}::text = ANY(${resolved}::text[]) THEN COALESCE(resolved_at, now()) ELSE NULL END`,
    );
  }
  if (changes.category !== undefined) {
    const category = param(changes.category);
    sets.push(`category = ${category}`, "category_source = 'admin'");
    // The draft was written with the old category's policy.
    sets.push(
      `ai_draft = CASE WHEN category IS DISTINCT FROM ${category} THEN NULL ELSE ai_draft END`,
      `ai_draft_generated_at = CASE WHEN category IS DISTINCT FROM ${category} THEN NULL ELSE ai_draft_generated_at END`,
    );
  }
  if (changes.priority !== undefined) {
    sets.push(`priority = ${param(changes.priority)}`, "priority_source = 'admin'");
  }
  if (changes.assignedTo !== undefined) {
    sets.push(`assigned_to = ${param(changes.assignedTo)}`);
  }

  const { rowCount } = await query(`UPDATE tickets SET ${sets.join(', ')} WHERE id = $1`, params);
  if (rowCount === 0) throw AppError.notFound('Ticket');

  return getTicket(admin, ticketId);
}

export async function generateDraft(admin, ticketId) {
  await findTicketRow(admin, ticketId);
  return aiGenerateDraft(ticketId);
}

/** Re-runs LLM classification, e.g. after an outage left a ticket on keyword triage. */
export async function reclassify(admin, ticketId) {
  await findTicketRow(admin, ticketId);
  const result = await classifyTicket(ticketId);
  if (!result) {
    throw AppError.serviceUnavailable('AI_UNAVAILABLE', 'AI classification is unavailable right now. Set the category manually or try again shortly.');
  }
  return getTicket(admin, ticketId);
}

export async function addNote(admin, ticketId, body) {
  const { rows } = await query(
    `WITH inserted AS (
       INSERT INTO ticket_notes (ticket_id, admin_id, body)
       SELECT id, $2, $3 FROM tickets WHERE id = $1
       RETURNING *
     )
     SELECT inserted.*, u.name AS admin_name FROM inserted JOIN users u ON u.id = inserted.admin_id`,
    [ticketId, admin.id, body],
  );
  if (!rows[0]) throw AppError.notFound('Ticket');
  return toNote(rows[0]);
}
