import { z } from 'zod';
import { buildAccountFacts } from '../ai/accountFacts.js';
import { LlmError, chatCompletion, isLlmConfigured } from '../ai/groqClient.js';
import { CLASSIFICATION_SCHEMA, buildClassificationMessages, buildDraftMessages } from '../ai/prompts.js';
import { config } from '../config/env.js';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../constants/tickets.js';
import { query } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';

const classificationResult = z.object({
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
  reasoning: z.string().max(400),
});

async function logRequest(entry) {
  try {
    await query(
      `INSERT INTO ai_requests (ticket_id, purpose, model, status, prompt_tokens, completion_tokens, latency_ms, error_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.ticketId,
        entry.purpose,
        entry.model,
        entry.status,
        entry.usage?.promptTokens ?? null,
        entry.usage?.completionTokens ?? null,
        entry.latencyMs ?? null,
        entry.errorCode ?? null,
      ],
    );
  } catch (err) {
    console.error('Failed to log AI request', err.message);
  }
}

/**
 * Tries each model in order; a rate limit or outage on the primary model falls
 * through to the fallback model before giving up. `parse` may throw to reject
 * an unusable response, which also falls through.
 */
async function completeWithFallback({ purpose, ticketId, models, request, parse = (content) => content }) {
  let lastError;
  for (const model of [...new Set(models)]) {
    try {
      const result = await chatCompletion({ ...request, model });
      const value = parse(result.content);
      await logRequest({ ticketId, purpose, model: result.model, status: 'success', ...result });
      return { value, model: result.model };
    } catch (err) {
      lastError = err;
      await logRequest({
        ticketId,
        purpose,
        model,
        status: 'error',
        latencyMs: err.latencyMs,
        errorCode: err instanceof LlmError ? err.code : 'INVALID_OUTPUT',
      });
      if (err instanceof LlmError && (err.code === 'NOT_CONFIGURED' || err.code === 'AUTH_ERROR')) break;
    }
  }
  throw lastError;
}

async function loadTicketContext(ticketId) {
  const { rows } = await query(
    `SELECT t.id, t.author_id, t.book_id, t.subject, t.description, t.category, u.name AS author_name
     FROM tickets t
     JOIN authors a ON a.id = t.author_id
     JOIN users u ON u.id = a.user_id
     WHERE t.id = $1`,
    [ticketId],
  );
  const ticket = rows[0];
  if (!ticket) throw AppError.notFound('Ticket');

  const { rows: books } = await query('SELECT * FROM books WHERE author_id = $1 ORDER BY title', [ticket.author_id]);
  const book = books.find((b) => b.id === ticket.book_id) ?? null;
  return { ticket, book, books };
}

/**
 * Classifies a ticket with the LLM and stores the result. Fields an admin has
 * already overridden are left alone. Returns null when the LLM is unavailable;
 * the keyword classification set at creation time then stays in place.
 */
export async function classifyTicket(ticketId) {
  if (!isLlmConfigured()) return null;

  const { ticket, book } = await loadTicketContext(ticketId);
  try {
    const { value } = await completeWithFallback({
      purpose: 'classify',
      ticketId,
      models: [config.ai.classifyModel, config.ai.fallbackModel],
      request: {
        messages: buildClassificationMessages({ subject: ticket.subject, description: ticket.description, book }),
        jsonSchema: CLASSIFICATION_SCHEMA,
        temperature: 0,
        maxTokens: 400,
      },
      parse: (content) => classificationResult.parse(JSON.parse(content)),
    });

    await query(
      `UPDATE tickets SET
         category = CASE WHEN category_source = 'admin' THEN category ELSE $2 END,
         category_source = CASE WHEN category_source = 'admin' THEN category_source ELSE 'ai' END,
         priority = CASE WHEN priority_source = 'admin' THEN priority ELSE $3 END,
         priority_source = CASE WHEN priority_source = 'admin' THEN priority_source ELSE 'ai' END,
         ai_reasoning = $4
       WHERE id = $1`,
      [ticketId, value.category, value.priority, value.reasoning],
    );
    return value;
  } catch (err) {
    console.warn(`AI classification failed for ticket ${ticketId}: ${err.code ?? err.message}`);
    return null;
  }
}

function cleanDraft(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .trim();
}

/** Generates (or regenerates) the reply draft for a ticket and caches it on the ticket. */
export async function generateDraft(ticketId) {
  if (!isLlmConfigured()) {
    throw AppError.serviceUnavailable('AI_UNAVAILABLE', 'AI drafting is not configured. Please write the reply manually.');
  }

  const { ticket, book, books } = await loadTicketContext(ticketId);
  const { rows: messages } = await query(
    `SELECT m.body, u.role FROM ticket_messages m JOIN users u ON u.id = m.sender_id
     WHERE m.ticket_id = $1 ORDER BY m.created_at, m.id`,
    [ticketId],
  );

  const accountFacts = buildAccountFacts({
    authorName: ticket.author_name,
    category: ticket.category,
    book,
    otherBooks: book ? [] : books,
  });

  try {
    const { value: draft, model } = await completeWithFallback({
      purpose: 'draft',
      ticketId,
      models: [config.ai.draftModel, config.ai.fallbackModel],
      request: {
        messages: buildDraftMessages({
          category: ticket.category,
          subject: ticket.subject,
          description: ticket.description,
          accountFacts,
          history: messages.map((m) => ({ role: m.role, body: m.body })),
        }),
        temperature: 0.3,
        maxTokens: 1200,
      },
      parse: (content) => {
        const cleaned = cleanDraft(content);
        if (cleaned.length < 40) throw new Error('Draft too short');
        return cleaned;
      },
    });

    const { rows } = await query(
      `UPDATE tickets SET ai_draft = $2, ai_draft_generated_at = now()
       WHERE id = $1 RETURNING ai_draft_generated_at`,
      [ticketId, draft],
    );
    return { draft, model, generatedAt: rows[0].ai_draft_generated_at };
  } catch (err) {
    const code = err instanceof LlmError ? err.code : 'INVALID_OUTPUT';
    console.warn(`AI draft failed for ticket ${ticketId}: ${code}`);
    const message =
      code === 'RATE_LIMITED'
        ? 'The AI service is rate-limited right now. Please write the reply manually or try again in a minute.'
        : 'The AI service is unavailable right now. Please write the reply manually or try again shortly.';
    throw AppError.serviceUnavailable('AI_UNAVAILABLE', message);
  }
}

/** Token and reliability summary for the admin dashboard. */
export async function getUsageSummary({ days = 30 } = {}) {
  const { rows } = await query(
    `SELECT purpose, model,
            count(*)::int AS requests,
            count(*) FILTER (WHERE status = 'error')::int AS errors,
            coalesce(sum(prompt_tokens), 0)::int AS prompt_tokens,
            coalesce(sum(completion_tokens), 0)::int AS completion_tokens,
            round(avg(latency_ms) FILTER (WHERE status = 'success'))::int AS avg_latency_ms
     FROM ai_requests
     WHERE created_at >= now() - make_interval(days => $1)
     GROUP BY purpose, model
     ORDER BY purpose, model`,
    [days],
  );
  return {
    configured: isLlmConfigured(),
    days,
    byModel: rows.map((r) => ({
      purpose: r.purpose,
      model: r.model,
      requests: r.requests,
      errors: r.errors,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      avgLatencyMs: r.avg_latency_ms,
    })),
  };
}
