# BookLeaf Author Support & Communication Portal

PERN stack (PostgreSQL, Express, React, Node.js) app for handling author support tickets with AI-assisted classification and response drafting.

> Work in progress — this README will grow as features land.

## Local setup

Requirements: Node.js 20+ and a PostgreSQL database. We use [Supabase](https://supabase.com) (managed Postgres); any Postgres 14+ works.

```bash
# 1. Configure the API
cd server
cp .env.example .env          # set DATABASE_URL (Supabase session pooler URI), JWT_SECRET and GROQ_API_KEY
npm install

# 2. Create tables and load the sample dataset
npm run db:reset

# 3. Run the API on http://localhost:4000
npm run dev

# 4. In a second terminal, run the web app on http://localhost:5173
cd client
cp .env.example .env          # VITE_API_URL, defaults to http://localhost:4000/api
npm install
npm run dev
```

`npm run db:reset` drops and recreates all tables, so it is safe to re-run at any time. The login page has one-click demo account buttons.

## Test credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bookleaf.com` | `Admin@123` |
| Admin | `ops@bookleaf.com` | `Admin@123` |
| Author | any author email from the dataset, e.g. `priya.sharma@email.com` | `Author@123` |

## Project structure

```
server/src/
  ai/           Groq client, knowledge base, prompts, account facts, keyword fallback
  config/       environment loading and validation
  db/           connection pool, schema.sql, seed script, sample data
  middleware/   authentication, role checks, request validation, error handling
  realtime/     in-process event bus for live updates
  routes/       URL definitions
  controllers/  HTTP layer: read request, send response
  services/     business logic and database queries
  validators/   zod request schemas
  utils/        shared helpers (AppError)

client/src/
  components/   app shell, badges, message thread, shared states; ui/ holds shadcn components
  context/      auth session
  hooks/        live updates (SSE), debounce
  lib/          API client, enum display metadata, formatting
  pages/        author/ (books, tickets) and admin/ (queue, ticket workspace)
```

Frontend: React 19 + Vite, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query for server state, React Router.

## API (so far)

All error responses use the shape `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | none | API and database status |
| POST | `/api/auth/login` | none | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Bearer token | Current user profile |
| GET | `/api/books` | author, admin | Authors: own books + royalty summary. Admins: all books, optional `?authorId=` |
| GET | `/api/books/:id` | author, admin | One book (authors get 404 for books that are not theirs) |
| GET | `/api/tickets` | author, admin | List tickets (see filters below) |
| POST | `/api/tickets` | author | `{ bookId \| null, subject, description, attachmentName? }` |
| GET | `/api/tickets/:id` | author, admin | Ticket with messages. Admins also get AI fields, internal notes and full book data |
| PATCH | `/api/tickets/:id` | admin | Any of `{ status, category, priority, assignedTo }`; category/priority changes are recorded as admin overrides |
| POST | `/api/tickets/:id/messages` | author, admin | `{ body, aiAssisted? }` — reply visible to the author |
| POST | `/api/tickets/:id/notes` | admin | `{ body }` — internal note, never shown to authors |
| POST | `/api/tickets/:id/draft` | admin | Generate (or regenerate) the AI reply draft → `{ draft, model, generatedAt }`. 503 `AI_UNAVAILABLE` if the LLM is down |
| POST | `/api/tickets/:id/classify` | admin | Re-run AI classification (e.g. after an outage). Admin overrides are kept. 503 `AI_UNAVAILABLE` if the LLM is down |
| GET | `/api/users/admins` | admin | Admins available for assignment |
| GET | `/api/ai/usage` | admin | Requests, errors, tokens and latency per model, `?days=30` |
| GET | `/api/events` | author, admin | Server-Sent Events stream of ticket changes (see below) |

**Ticket list filters** (`GET /api/tickets`): `status`, `category`, `priority` (each accepts a comma-separated list, e.g. `status=open,in_progress`), `assignedTo` (`me`, `unassigned` or an admin id), `from` / `to` (`YYYY-MM-DD`), `search`, `sort` (`urgency` default, `newest`, `oldest`, `updated`), `page`, `pageSize` (max 100). Category, priority, assignment and search filters apply to admins only.

**Default queue order** (`sort=urgency`): unresolved tickets first, then by priority (critical → low), then oldest first, so the most urgent long-waiting tickets are always at the top.

**Ticket lifecycle rules**
- An admin reply on an `open` ticket moves it to `in_progress` and assigns it to that admin if it is unassigned.
- An author reply on a `resolved` ticket reopens it; authors cannot reply to `closed` tickets (409).
- Setting status to `resolved`/`closed` records `resolvedAt`; reopening clears it.

## Real-time updates

`GET /api/events` is a Server-Sent Events stream. Events carry only ids, e.g. `event: message.created` / `data: {"type":"message.created","ticketId":9}`; the client then re-fetches through the normal REST endpoints, so role-based access control lives in one place and nothing private travels over the stream.

| Event | Sent to |
|---|---|
| `ticket.created`, `message.created` | admins + the ticket's author |
| `ticket.updated` | admins; the author too when the status changed |
| `ticket.classified`, `note.created` | admins only |

The client reads the stream with `fetch` instead of `EventSource`, so the JWT goes in the `Authorization` header rather than the URL (where it would end up in access logs). It reconnects with exponential backoff and re-fetches on reconnect to catch anything missed. A 25-second heartbeat keeps proxies from closing idle connections. The event bus is in-process; running several API instances would need Postgres `LISTEN/NOTIFY` or Redis instead.

## AI integration

**Provider and models (Groq).** Groq serves open-weight models with very low latency (≈0.6 s classification, ≈1–2 s drafts in testing) and low per-token pricing, which suits a support tool where an admin is waiting on a draft.

| Task | Model | Why |
|---|---|---|
| Classification + priority | `openai/gpt-oss-20b` | Small and cheap; strict JSON schema output, temperature 0 |
| Reply drafts | `openai/gpt-oss-120b` | Better writing and instruction following for author-facing text |
| Fallback for both | `qwen/qwen3.8-27b` | Different model family, used when the primary is rate-limited or down |

All three are configurable through `GROQ_*` environment variables.

**Ticket flow**
1. On creation the ticket is classified instantly by a keyword classifier (`category_source = 'fallback'`) and saved. The author never waits on the LLM.
2. The LLM classification runs in the background and replaces the keyword result (`source = 'ai'`), with a one-sentence reasoning the admin can scan. Fields an admin has already overridden (`source = 'admin'`) are never overwritten.
3. When an admin opens a ticket, the client requests a draft. It is cached on the ticket and cleared automatically when a new message arrives or the admin changes the category, so it is only regenerated when it would actually differ.

**Prompt strategy** (`server/src/ai/`)
- `knowledgeBase.js` splits the BookLeaf knowledge base by category. A draft prompt carries the company overview, tone guidelines, *only the policy section for the ticket's category*, and one calibration example from BookLeaf's sample responses.
- `accountFacts.js` pre-computes facts in code rather than asking the model to do date or threshold maths: next payout date from the quarterly cycle + 45 days, whether a balance is below the ₹1,000 threshold (rolls over), whether a payout looks overdue, current production stage and remaining stages. Royalty facts are only included for royalty and general tickets.
- Rules forbid inventing dates, amounts or actions not present in the facts or policy, and are repeated at the end of the prompt. Author text is fenced in `<ticket>` / `<conversation>` tags and treated as data, to resist prompt injection.
- Output is plain text, 90–200 words, opening with the author's first name and ending with a clear next step.

**Cost controls**
- Category-scoped knowledge base instead of the full document (roughly a third of the tokens).
- Only the last 6 messages are sent, each truncated to 800 characters; descriptions are capped at 3,000 characters.
- Classification uses the small model; gpt-oss runs with `reasoning_effort: low` to limit hidden reasoning tokens.
- Drafts are cached and only regenerated when the conversation or category changes.
- Every call is logged to `ai_requests` (model, tokens, latency, error code) and summarised at `GET /api/ai/usage`. Measured averages: ~660 tokens per classification, ~1,230 per draft.

**Graceful degradation**
- Each Groq call has a timeout (`GROQ_TIMEOUT_MS`, default 15 s) and one retry with backoff on 429 / 5xx / network errors, honouring `retry-after`.
- If the primary model still fails, the fallback model is tried; invalid model output (bad JSON, empty draft) also falls through.
- If everything fails: tickets are still created with keyword classification, drafts return `503 AI_UNAVAILABLE` with a "write the reply manually" message, and the admin can reply, override and later re-run classification.
- Without `GROQ_API_KEY` the app runs entirely on keyword classification and manual replies.

**Key security.** `GROQ_API_KEY` is read only on the server from environment variables (validated in `config/env.js`), never sent to the client, and `.env` is git-ignored.
