# BookLeaf Author Support & Communication Portal

A support website for BookLeaf Publishing. It has two sides:

- **Authors** log in, see their books and royalties, and send support questions (tickets).
- **The BookLeaf team** sees all tickets in one list. Each new ticket is sorted into a category and given a priority by AI, and the AI writes a first draft of the reply using BookLeaf's own policies. The team checks the draft, edits it and sends it.

Built with PostgreSQL (on Supabase), Express, React and Node.js. AI is from Groq. Live updates use Server-Sent Events.

## Contents

- [Live demo](#live-demo)
- [Test logins](#test-logins)
- [Features](#features)
- [Run it on your computer](#run-it-on-your-computer)
- [How the code is organised](#how-the-code-is-organised)
- [How the AI works](#how-the-ai-works)
- [API documentation](#api-documentation)
- [Live updates](#live-updates)
- [Deployment](#deployment)
- [What's missing and what I'd add next](#whats-missing-and-what-id-add-next)
- [Write-up](#write-up)

## Live demo

| | Link |
|---|---|
| Website | [https://book-leaf-s-cy1o.vercel.app](https://book-leaf-s-cy1o.vercel.app) |
| API | `https://<your-api>.onrender.com/api` (check it's running: `/api/health`) |

The database already has the sample data (10 authors, 18 books). The API is on Render's free plan, which goes to sleep after 15 minutes with no visitors. The first request after that can take about 30 seconds.

## Test logins

The login page has buttons that fill these in for you.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bookleaf.com` | `Admin@123` |
| Admin | `ops@bookleaf.com` | `Admin@123` |
| Author | `priya.sharma@email.com` | `Author@123` |
| Author | `sneha.kulkarni@email.com` (has a book still being made) | `Author@123` |
| Author | `kavita.deshmukh@email.com` (has a book still being made) | `Author@123` |

Every author in the sample data can log in with their email and `Author@123`: `rohit.kapoor`, `ananya.reddy`, `vikram.joshi`, `meera.nair`, `arjun.malhotra`, `farhan.sheikh` and `diya.chatterjee`, all ending in `@email.com`.

**A quick way to try it:** log in as an author and send a ticket. In another browser (or a private window), log in as an admin. The ticket shows up in the list already sorted. Open it, look at the AI draft, edit it and send it. The reply appears on the author's screen without refreshing.

## Features

**Author side**
- Log in with email and password. Authors can only see their own data. The server checks this, not just the screen.
- **My Books**: title, ISBN, genre, publish date, status, price (MRP), copies sold, royalty earned, paid and pending, where it's sold, and the last payout date. A summary of all books sits at the top.
  - Books still being made show which stage they're at, instead of showing zero sales.
  - Pending royalty under ₹1,000 is marked as "moves to next quarter", as per BookLeaf's rule.
  - Search, filter by live or in-progress, sort, and pages.
- **Send a question**: pick a book (or "General / Account Level"), write a subject and the details, and optionally add a file (only the file name is saved, see below). The form checks the input before sending, and so does the server.
- **My Tickets**: each ticket's status, the original question and all replies, updating live. Tabs for open, solved and all tickets, plus search, sort and pages. Authors can reply, and replying to a solved ticket opens it again.

**Admin side**
- **Ticket list**:
  - Filter by status, category, priority, who it's assigned to, and date, or search by text.
  - By default, open tickets come first, then the most urgent, then the ones waiting longest.
  - Tickets waiting over 1 day or over 3 days are coloured so they stand out.
  - The four boxes at the top (open, urgent, unassigned, mine) show counts and work as one-click filters.
  - The list opens on "Assigned to me".
- **AI category and priority** for every new ticket, with a one-line reason. Admins can change both. Once an admin changes one, the AI never changes it back.
- **AI draft reply** when a ticket is opened, based on BookLeaf's policies and the author's real book data. The admin can edit it, ask for a new one, or write their own.
- **Managing tickets**: change status, add private notes (authors never see them), assign to any admin, and see the author's and book's details next to the conversation.
- Pop-up alerts for new tickets and replies.

## Run it on your computer

You need Node.js 20 or newer and a PostgreSQL database. I used [Supabase](https://supabase.com) (a hosted PostgreSQL). A local PostgreSQL also works; set `DATABASE_SSL=false`.

```bash
# 1. Set up the API
cd server
cp .env.example .env     # fill in DATABASE_URL, JWT_SECRET and (optional) GROQ_API_KEY
npm install

# 2. Create the tables and load the sample data
npm run db:reset

# 3. Start the API on http://localhost:4000
npm run dev

# 4. In a second terminal, start the website on http://localhost:5173
cd client
cp .env.example .env     # VITE_API_URL, default is http://localhost:4000/api
npm install
npm run dev
```

`npm run db:reset` deletes and rebuilds all tables and reloads the sample data, so you can run it as often as you like. `npm run db:schema` and `npm run db:seed` do the two steps on their own.

**Server settings** (checked when the server starts; if one is missing or wrong, the server stops and says which one):

| Setting | Needed? | What it's for |
|---|---|---|
| `DATABASE_URL` | yes | The database address. For Supabase, use the "Session pooler" link. If the password has special characters, they must be URL-encoded |
| `DATABASE_SSL` | no (default `true`) | Set to `false` for a local database without SSL |
| `JWT_SECRET` | yes | A random secret of at least 32 characters, used to sign login tokens |
| `JWT_EXPIRES_IN` | no (default `1d`) | How long a login lasts |
| `CLIENT_ORIGIN` | in production | The website address(es) allowed to call the API, separated by commas. Anything after the domain (like `/login`) is ignored. When not in production, any `localhost` address is also allowed |
| `GROQ_API_KEY` | no | Without it, the app uses simple keyword sorting and admins write replies themselves |
| `GROQ_CLASSIFY_MODEL`, `GROQ_DRAFT_MODEL`, `GROQ_FALLBACK_MODEL`, `GROQ_TIMEOUT_MS` | no | Change the AI models or the time limit |
| `SEED_AUTHOR_PASSWORD`, `SEED_ADMIN_PASSWORD` | no | Passwords given to the sample accounts |

## How the code is organised

```
Website (Vercel) ── requests with login token ──▶ API (Render) ──▶ Database (Supabase)
       ▲                                            │
       └────────── live updates ◀───────────────────┤
                                                    └──▶ Groq AI (sorting, drafts)
```

```
server/src/
  ai/           talking to Groq, BookLeaf policies, prompts, account facts, keyword backup
  config/       reads and checks the settings
  constants/    ticket statuses, categories, priorities
  db/           database connection, table definitions, setup scripts, sample data
  middleware/   login check, role check, input check, error handling
  realtime/     sends live updates to open browsers
  routes/       the list of URLs
  controllers/  reads the request and sends the response
  services/     the actual rules and database queries
  validators/   rules for what each request must contain
  utils/        shared error class

client/src/
  components/   page layout, badges, message thread, reply box, pages, loading/empty/error states; ui/ has the base components
  context/      who is logged in
  hooks/        live updates, search delay
  lib/          talking to the API, labels, date and money formatting
  pages/        author/ (books, tickets, new ticket) and admin/ (ticket list, ticket page)
```

### Choices I made, and why

- **The API is split into three layers: routes, controllers and services.** Each route shows in one line who can use it and what input it needs. Controllers only deal with the request and response. Services hold the rules and the database queries. The "authors only see their own data" check is inside the database queries, so even a mistake on the website can't show someone else's data.
- **PostgreSQL with plain SQL, no ORM.** The data is connected (users, authors, books, tickets, messages, notes), and the ticket list needs custom sorting and filtering, which is easier to read in plain SQL. The database also guards itself: only allowed values for status, category and priority, links between tables, and indexes so the common lists load fast. Money is stored as exact decimals.
- **Supabase** gives a hosted PostgreSQL with nothing to manage. The app only uses it as a database, so it could move to any PostgreSQL.
- **AI results are saved on the ticket** (category, priority, reason, draft). Each category and priority also records *who* set it: the keyword backup, the AI, or an admin. That's how the AI knows never to overwrite an admin's choice, and how the screen shows where each value came from.
- **Every request is checked before it's used** (with the zod library). Bad input gets a clear `400` error that says which field is wrong, instead of a server crash.
- **One error format everywhere.** Every error, even unexpected ones, comes back as `{ error: { code, message, details? } }`. In production, internal details are hidden.
- **Login uses a signed token (JWT) and hashed passwords (bcrypt).** It's simple and works well on one server. A small check (`authorize(role)`) blocks authors from admin URLs.
- **Live updates use Server-Sent Events, not WebSockets.** Updates only go from the server to the browser, so the simpler option is enough. It works over normal HTTP, works on Render, and needs no extra library. The updates only say *what* changed (for example "ticket 9 has a new message"). The browser then asks the API for the data, so the same access rules apply.
- **React with TanStack Query on the website.** It keeps data in memory and refreshes it in the background, so filters and pages feel fast. A live update just tells it which data to refresh. The base components (shadcn/ui) are accessible out of the box.
- **The website is on Vercel and the API is on Render.** Vercel is good at serving a static website. Render keeps the API running all the time, which live updates need. Both are set up by files in the repo (`client/vercel.json`, `server/render.yaml`).

## How the AI works

**Why Groq.** Groq is very fast: about 0.6 seconds to sort a ticket and 1–2 seconds for a draft in my tests. It's also cheap, and that matters for a tool where an admin is waiting for the draft. The models are open, so the same prompts could run elsewhere, and Groq offers a second, different model as a backup.

| Job | Model | Why |
|---|---|---|
| Category and priority | `openai/gpt-oss-20b` | Small and cheap; returns a fixed JSON format; no randomness (temperature 0) |
| Reply drafts | `openai/gpt-oss-120b` | Writes better and follows instructions better, which matters for text authors will read |
| Backup for both | `qwen/qwen3.8-27b` | A different model, used if the main one is busy or down |

All three can be changed with the `GROQ_*` settings.

**What happens to a ticket**
1. When an author sends a ticket, simple keyword rules sort it straight away and it's saved. The author never waits for the AI, and the ticket is never lost if the AI fails.
2. The AI then sorts it in the background and replaces the keyword result, adding a one-line reason. If an admin has already changed the category or priority, the AI leaves it alone. Admins get a live update when it's done.
3. When an admin opens the ticket, the AI writes a draft. The draft is saved on the ticket and only made again when something changes (a new message, or a new category).

**How the prompts are built** (`server/src/ai/`)
- `knowledgeBase.js` splits BookLeaf's policies by category. A draft prompt gets the company overview, the tone guide, **only the policy for that ticket's category**, and one of BookLeaf's own example replies to copy the style.
- `accountFacts.js` works out the facts in code instead of asking the AI to do maths or dates:
  - the next payout date (quarter end + 45 days)
  - whether the balance is under ₹1,000 and moves to next quarter
  - whether a payout looks late
  - the book's current production stage and the stages left

  Royalty facts are only added for royalty and general tickets, so a question about Amazon stock doesn't get a paragraph about royalties.
- When the system doesn't know something (for example when a production stage started, or why there's a delay), the prompt says so. The AI then offers to check or escalate instead of making something up. Bank details aren't in the data either, so royalty drafts ask the author to confirm them, like BookLeaf's own example does.
- The rules say: don't make up dates, amounts or actions that aren't in the facts or policy. They're repeated at the end of the prompt, where the AI pays most attention. The author's text is wrapped in `<ticket>` tags and treated as plain text, so an author can't sneak instructions to the AI.
- The draft is plain text, 90–200 words. It starts with the author's first name, acknowledges the problem before giving answers, owns BookLeaf's mistakes, gives real timelines, and ends with a clear next step, as BookLeaf's tone guide asks.
- Sorting asks for a fixed JSON answer (`category`, `priority`, `reasoning`) with clear priority rules. For example, months of missing royalty or a wrong ISBN is high or critical, and changing an author bio is low.

**Keeping costs down**
- Only the policy for the ticket's category is sent, not all of them (about a third of the size).
- Only the last 6 messages are sent, each cut to 800 characters. Ticket descriptions are cut to 3,000 characters.
- Sorting uses the small model, and the models are told to keep their hidden "thinking" short (`reasoning_effort: low`).
- Drafts are saved and only made again when something changes. Sorting runs once per ticket unless an admin asks for it again.
- Every AI call is logged in the `ai_requests` table (what it was for, which model, tokens used, how long it took, any error). Admins can see a summary at `GET /api/ai/usage`. On average a sort uses about 660 tokens and a draft about 1,230.

**When the AI fails**
- Each AI call has a time limit (15 seconds by default). If it's busy, errors out or the network drops, it waits and tries once more.
- If the main model still fails, the backup model is tried. A broken answer (bad JSON, empty draft) also moves on to the backup.
- If everything fails:
  - Tickets are still saved, using the keyword sorting.
  - The draft request returns `503 AI_UNAVAILABLE`, and the admin sees a message to write the reply themselves.
  - Admins can still reply, change the category or priority, and re-run the AI later.
- Without a `GROQ_API_KEY`, the whole app still works, using keyword sorting and manual replies.

**Keeping the API key safe.** `GROQ_API_KEY` is only read on the server from its settings. It's never sent to the browser and never logged. `.env` files are not in git. On Render, secrets are typed into the dashboard, not stored in the repo.

## API documentation

Base address: `http://localhost:4000/api` on your computer, `https://<your-api>.onrender.com/api` live.

**Logging in.** `POST /auth/login` gives you a token. Send it as `Authorization: Bearer <token>` on every other request. Only `/health` and `/auth/login` work without it. Using a URL your role isn't allowed gives `403`. An author asking for someone else's ticket or book gets `404`, so they can't even tell it exists.

**Responses.** Data comes back inside `data`. The login URLs are the exception: they return `{ token, user }` and `{ user }`. Lists also include `pagination: { page, pageSize, total }`. Creating something returns `201`.

**Errors** always look like this:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [{ "location": "body", "field": "subject", "message": "Subject must be at least 5 characters" }] } }
```

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | The input is wrong; `details` lists each field |
| 400 | `BAD_REQUEST` | Broken JSON, a value the database won't accept, or a link to something that doesn't exist |
| 401 | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED` | No token, a bad token, or an expired token |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `FORBIDDEN` | Logged in, but your role can't do this |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND` | It doesn't exist (or isn't yours), or the URL doesn't exist |
| 409 | `CONFLICT` | For example, replying to a closed ticket |
| 413 | `PAYLOAD_TOO_LARGE` | The request is over 100 KB |
| 503 | `AI_UNAVAILABLE` | The AI is down or busy (draft and re-sort only) |
| 500 | `INTERNAL_ERROR` | Something unexpected; details are hidden in production |

### All endpoints

| Method | Path | Who | What it does |
|---|---|---|---|
| GET | `/health` | anyone | Is the API and database up |
| POST | `/auth/login` | anyone | Log in |
| GET | `/auth/me` | logged in | Who am I |
| GET | `/books` | logged in | Books with a royalty summary (authors only get their own) |
| GET | `/books/:id` | logged in | One book |
| GET | `/tickets` | logged in | List tickets (authors only get their own) |
| POST | `/tickets` | author | Create a ticket |
| GET | `/tickets/:id` | logged in | One ticket with its messages |
| PATCH | `/tickets/:id` | admin | Change status, category, priority or who it's assigned to |
| POST | `/tickets/:id/messages` | logged in | Reply (the author sees it) |
| POST | `/tickets/:id/notes` | admin | Add a private note |
| POST | `/tickets/:id/draft` | admin | Make (or remake) the AI draft |
| POST | `/tickets/:id/classify` | admin | Re-run the AI sorting |
| GET | `/users/admins` | admin | Admins a ticket can be assigned to |
| GET | `/ai/usage` | admin | AI usage and cost summary |
| GET | `/events` | logged in | Live updates stream |

#### `POST /auth/login`

```json
// send
{ "email": "priya.sharma@email.com", "password": "Author@123" }
// 200
{ "token": "eyJ...", "user": { "id": 3, "name": "Priya Sharma", "email": "priya.sharma@email.com", "role": "author", "authorId": "AUTH001" } }
```

A wrong email and a wrong password both give the same `401 INVALID_CREDENTIALS` message, so nobody can use it to find out which emails exist.

#### `GET /books`

Options: `search` (title, genre or ISBN), `status` (`live` or `production`), `sort` (`newest` is the default, `oldest`, `title`, `sales`, `pending`), `page`, `pageSize` (default and max 100), `authorId` (admins only).

Returns `data` (each book's ISBN, genre, publish date, status, MRP, copies sold, royalty earned/paid/pending, last payout date and platforms), `pagination`, and `summary` (totals for all your books, whatever the filters).

#### `GET /tickets`

| Option | Values |
|---|---|
| `status`, `category`, `priority` | One or more, separated by commas, e.g. `status=open,in_progress`, `priority=critical,high` |
| `assignedTo` | `me`, `unassigned` or an admin's id (admins only) |
| `from`, `to` | `YYYY-MM-DD`, by date created (`from` can't be after `to`) |
| `search` | Looks in the subject, description, author name and book title |
| `sort` | `urgency` (default), `newest`, `oldest`, `updated` |
| `page`, `pageSize` | Max 100 per page |

`sort=urgency` puts open tickets first, then sorts by priority (critical to low), then oldest first. So the most urgent tickets that have waited longest are always at the top.

Allowed values: status `open`, `in_progress`, `resolved`, `closed`; category `royalty_payments`, `isbn_metadata`, `printing_quality`, `distribution_availability`, `book_status_production`, `general_inquiry`; priority `critical`, `high`, `medium`, `low`.

#### `POST /tickets` (author)

```json
// send (bookId null or left out = "General / Account Level")
{ "bookId": "BK001", "subject": "Royalty for last quarter not received", "description": "I haven't received my Q2 royalty yet...", "attachmentName": "statement.png" }
// 201 → the new ticket, already sorted by the keyword rules
```

Rules: subject 5–150 characters, description 20–5,000 characters, and `bookId` must be one of the author's own books.

#### `GET /tickets/:id`

Returns the ticket with its book, author and messages. Admins also get who set the category and priority, the AI's reason, the saved draft, private notes, who it's assigned to, and the full book royalty data. Authors never get notes, drafts or any AI details.

#### `PATCH /tickets/:id` (admin)

```json
{ "status": "resolved", "category": "isbn_metadata", "priority": "high", "assignedTo": 1 }
```

Send any of these, at least one. Unknown fields are rejected. A changed category or priority is saved as set by an admin. `assignedTo: null` removes the assignment.

#### `POST /tickets/:id/messages`

`{ "body": "...", "aiAssisted": true }`. The body is 1–5,000 characters. `aiAssisted` is for admins only and records whether the reply started from the AI draft.

Ticket rules:
- When an admin replies to an `open` ticket, it becomes `in_progress`, and if nobody was assigned, it's assigned to that admin.
- When an author replies to a `resolved` ticket, it opens again. Replying to a `closed` ticket gives `409`.
- Setting the status to `resolved` or `closed` saves the time it was solved. Opening it again clears that.
- Any new message removes the saved draft, so the next one is fresh.

#### `POST /tickets/:id/notes` (admin)

`{ "body": "..." }` (1–2,000 characters). Private to admins.

#### `POST /tickets/:id/draft` (admin)

Makes a draft (or a new one) and saves it on the ticket: `{ "data": { "draft": "Hi Priya, ...", "model": "openai/gpt-oss-120b", "generatedAt": "..." } }`. Returns `503 AI_UNAVAILABLE` if every model fails.

#### `POST /tickets/:id/classify` (admin)

Runs the AI sorting again, for example after the AI was down. Anything an admin changed stays as it is. Returns `503 AI_UNAVAILABLE` if the AI is down.

#### `GET /ai/usage` (admin)

`?days=30` (1–365). Number of calls, errors, tokens and average time, per job and model.

## Live updates

`GET /api/events` keeps a connection open and sends a short message whenever a ticket changes, for example `event: message.created` with `data: {"type":"message.created","ticketId":9}`. The message only has the ticket number. The browser then fetches the ticket through the normal API, so the same access rules apply and nothing private is sent over the live connection.

| Update | Who gets it |
|---|---|
| `ticket.created`, `message.created` | admins and the ticket's author |
| `ticket.updated` | admins, and the author if the status changed |
| `ticket.classified`, `note.created` | admins only |

The login token is sent in a header, not in the URL, so it doesn't end up in server logs. If the connection drops, the browser reconnects, waiting a bit longer each time, and refreshes the data so nothing is missed. A small "ping" every 25 seconds stops the connection being closed for being idle. The header shows "Live" or "Offline".

## Deployment

- **API on Render** using `server/render.yaml` (New → Blueprint, and set the Blueprint path to `server/render.yaml`). Type `DATABASE_URL` and `GROQ_API_KEY` into the Render dashboard. `CLIENT_ORIGIN` is already set to the Vercel address in the file, and Render creates `JWT_SECRET` itself. Render uses `/api/health` to check the API is up.
- **Website on Vercel** with the root folder set to `client` and the setting `VITE_API_URL=https://<your-api>.onrender.com/api`. `client/vercel.json` makes every page address load the app, so refreshing a page like `/tickets/5` works, and lets browsers keep the built files for a year.
- **Database on Supabase.** Run `npm run db:reset` once from `server/` with the live `DATABASE_URL` to create the tables and load the sample data.

## What's missing and what I'd add next

**What's missing**
- **File upload.** Only the file name is saved with the ticket, not the file. Next step: upload files to Supabase Storage or S3, with type and size checks, and let the AI look at photos for print-quality tickets.
- **Runs on one server only.** Live updates are sent from inside the one running server. To run more than one, they'd need to go through PostgreSQL `LISTEN/NOTIFY` or Redis.
- **Basic login only.** There's no sign-up, password reset or email check. The login token is kept in the browser's local storage, and there's no way to log a token out early. For real use I'd move the token to a secure cookie with short-lived tokens that refresh.
- **No rate limits yet.** Login and the AI URLs should limit how often they can be called before real users arrive.
- **No automated tests.** I tested everything by hand and with small scripts. Next: tests for the access rules and ticket flow on a test database, tests for the account facts and keyword sorting, and a small set of sample tickets to check that prompt changes don't make the AI worse.
- **AI sorting runs inside the server, not in a job queue.** If the server stops in the middle, the ticket keeps its keyword result (and an admin can re-run it). A job queue with retries would be safer.
- **The AI only knows what's in the sample data.** Bank details, sales per platform, payout history and stage dates aren't there, so drafts ask or offer to check instead of guessing.
- **Simple page numbers for lists.** Fine for now; a very large ticket list would need a faster method.
- **Free hosting sleeps when not used**, so the first visit can be slow.

**What I'd add with more time**
- Email the author when they get a reply, and alert the team when a ticket has waited too long.
- Track how often admins send the AI draft as-is versus how much they edit it, and use that to improve the prompts and examples.
- Use past solved tickets as extra examples for the AI once there are enough.
- Saved reply templates, bulk actions and merging duplicate tickets for the team, plus a history of every change to a ticket.
- A Swagger/OpenAPI file made from the input rules.

## Write-up

**What I focused on.** I started from how the work is marked. AI and code quality are half the score, so the main flow got the most attention: an author sends a ticket, it's sorted straight away, an admin gets a useful draft, edits it and sends it, and the author sees the reply live. I built that whole flow first on a clean API, then added the AI, live updates and the look of the site. My main rule for the AI was that nothing should depend on it. A ticket is saved and sorted by keywords in milliseconds, the AI improves that in the background, and every AI feature has a manual option for when the AI is down.

**AI choices.** A draft that sounds good but has wrong facts is worse than no draft, so most of my prompt work went into getting the facts right, not just the tone. Anything that needs maths or dates (payout dates, the ₹1,000 rule, late payments, production stage) is worked out in code and handed to the AI as clear facts. The policies are split by category so each prompt only carries what it needs, plus one of BookLeaf's own example replies for the tone. I tested drafts on realistic tickets and made the rules stricter every time the AI made up a date or promised something not in the policy. To keep costs down, I send only what's needed, cut long history, save drafts, use a small model for sorting, and log the tokens every call uses.

**Trade-offs.** I picked Groq's open models over GPT-4o-mini or Claude Haiku because they're faster, cheaper and come with a backup model, even if the writing is a little less polished. I used Server-Sent Events over WebSockets because updates only go one way, and plain SQL over an ORM because the ticket list queries are clearer that way. Keeping the token in local storage and sending live updates from one server are simple choices for a single server, and both are listed above as things to change. I left file upload, sign-up and automated tests for later, so I could make the main flow complete and reliable.

**Making it ready for real use.** First, make it safer and sturdier: secure cookie login, rate limits, real file uploads, a job queue for AI calls, PostgreSQL `LISTEN/NOTIFY` or Redis for live updates so it can run on more than one server, and proper logging and error tracking. Second, connect it to BookLeaf's real systems (royalty records, bank details, production tracker, platform stock), so drafts can state facts instead of asking, and let admins start actions like a stock re-sync or a reprint straight from the ticket. Third, measure and improve: track how much admins edit drafts, how often they change the AI's category, and how fast tickets get a first reply and get solved. Then use that to tune the prompts, add past tickets as examples, and later let the AI send simple replies (like status updates) on its own, with a person checking everything else.
