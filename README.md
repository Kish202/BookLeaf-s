# BookLeaf Author Support & Communication Portal

PERN stack (PostgreSQL, Express, React, Node.js) app for handling author support tickets with AI-assisted classification and response drafting.

> Work in progress — this README will grow as features land.

## Local setup

Requirements: Node.js 20+ and a PostgreSQL database. We use [Supabase](https://supabase.com) (managed Postgres); any Postgres 14+ works.

```bash
# 1. Configure the API
cd server
cp .env.example .env          # set DATABASE_URL (Supabase session pooler URI) and JWT_SECRET
npm install

# 2. Create tables and load the sample dataset
npm run db:reset

# 3. Run the API on http://localhost:4000
npm run dev
```

`npm run db:reset` drops and recreates all tables, so it is safe to re-run at any time.

## Test credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bookleaf.com` | `Admin@123` |
| Admin | `ops@bookleaf.com` | `Admin@123` |
| Author | any author email from the dataset, e.g. `priya.sharma@email.com` | `Author@123` |

## Project structure

```
server/src/
  config/       environment loading and validation
  db/           connection pool, schema.sql, seed script, sample data
  middleware/   authentication, role checks, request validation, error handling
  routes/       URL definitions
  controllers/  HTTP layer: read request, send response
  services/     business logic and database queries
  validators/   zod request schemas
  utils/        shared helpers (AppError)
```

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
| GET | `/api/users/admins` | admin | Admins available for assignment |

**Ticket list filters** (`GET /api/tickets`): `status`, `category`, `priority` (each accepts a comma-separated list, e.g. `status=open,in_progress`), `assignedTo` (`me`, `unassigned` or an admin id), `from` / `to` (`YYYY-MM-DD`), `search`, `sort` (`urgency` default, `newest`, `oldest`, `updated`), `page`, `pageSize` (max 100). Category, priority, assignment and search filters apply to admins only.

**Default queue order** (`sort=urgency`): unresolved tickets first, then by priority (critical → low), then oldest first, so the most urgent long-waiting tickets are always at the top.

**Ticket lifecycle rules**
- An admin reply on an `open` ticket moves it to `in_progress` and assigns it to that admin if it is unassigned.
- An author reply on a `resolved` ticket reopens it; authors cannot reply to `closed` tickets (409).
- Setting status to `resolved`/`closed` records `resolvedAt`; reopening clears it.
