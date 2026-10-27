-- BookLeaf Author Support Portal schema.
-- Running this file resets the database (drops and recreates every table).

DROP TABLE IF EXISTS ticket_notes CASCADE;
DROP TABLE IF EXISTS ticket_messages CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS authors CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS set_updated_at CASCADE;

CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Login identity for both authors and BookLeaf staff.
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('author', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Author profile; ids come from the BookLeaf dataset (e.g. AUTH001).
CREATE TABLE authors (
  id          VARCHAR(20) PRIMARY KEY,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  phone       TEXT,
  city        TEXT,
  joined_date DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Books in production have no publication date, MRP or royalty rate yet.
CREATE TABLE books (
  id                       VARCHAR(20) PRIMARY KEY,
  author_id                VARCHAR(20) NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
  title                    TEXT NOT NULL,
  isbn                     TEXT UNIQUE,
  genre                    TEXT,
  status                   TEXT NOT NULL,
  publication_date         DATE,
  mrp                      NUMERIC(10, 2) CHECK (mrp IS NULL OR mrp >= 0),
  author_royalty_per_copy  NUMERIC(10, 2) CHECK (author_royalty_per_copy IS NULL OR author_royalty_per_copy >= 0),
  total_copies_sold        INTEGER NOT NULL DEFAULT 0 CHECK (total_copies_sold >= 0),
  total_royalty_earned     NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_royalty_earned >= 0),
  royalty_paid             NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (royalty_paid >= 0),
  royalty_pending          NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (royalty_pending >= 0),
  last_royalty_payout_date DATE,
  print_partner            TEXT,
  available_on             TEXT[] NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX books_author_id_idx ON books (author_id);

-- *_source records who set the value, so admins can see whether the AI,
-- the keyword fallback, or a human made the call.
CREATE TABLE tickets (
  id                    SERIAL PRIMARY KEY,
  author_id             VARCHAR(20) NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
  book_id               VARCHAR(20) REFERENCES books (id) ON DELETE SET NULL,
  subject               TEXT NOT NULL,
  description           TEXT NOT NULL,
  attachment_name       TEXT,
  status                TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category              TEXT CHECK (category IN (
                          'royalty_payments',
                          'isbn_metadata',
                          'printing_quality',
                          'distribution_availability',
                          'book_status_production',
                          'general_inquiry'
                        )),
  category_source       TEXT CHECK (category_source IN ('ai', 'fallback', 'admin')),
  priority              TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  priority_source       TEXT CHECK (priority_source IN ('ai', 'fallback', 'admin')),
  ai_reasoning          TEXT,
  ai_draft              TEXT,
  ai_draft_generated_at TIMESTAMPTZ,
  assigned_to           INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ
);

CREATE INDEX tickets_author_created_idx ON tickets (author_id, created_at DESC);
CREATE INDEX tickets_queue_idx ON tickets (status, priority, created_at);
CREATE INDEX tickets_assigned_to_idx ON tickets (assigned_to);

CREATE TRIGGER tickets_set_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Conversation visible to the author (admin replies and author follow-ups).
CREATE TABLE ticket_messages (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL REFERENCES users (id),
  body        TEXT NOT NULL,
  ai_assisted BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ticket_messages_ticket_idx ON ticket_messages (ticket_id, created_at);

-- Internal staff notes; never exposed to authors.
CREATE TABLE ticket_notes (
  id         SERIAL PRIMARY KEY,
  ticket_id  INTEGER NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  admin_id   INTEGER NOT NULL REFERENCES users (id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ticket_notes_ticket_idx ON ticket_notes (ticket_id, created_at);
