-- =====================================================================
-- TicketPilot: database schema (lite version)
-- Run top to bottom in the Supabase SQL Editor on a NEW project.
--
-- Tables : tickets, ticket_messages, ticket_events, kb_chunks
-- Func   : match_kb_chunks (find the closest knowledge-base chunks)
--
-- WHO CAN DO WHAT
--   Staff    = any logged-in user. This is safe ONLY because public sign-ups
--              are turned OFF in Supabase (Authentication settings) and staff
--              accounts are created by hand.
--   Customer = no account. Customers never touch the database directly.
--              Server code uses the secret-key (service role) client to
--              create tickets and to read a ticket by its public_token.
--   The graph (AI pipeline), ingestion script and seed also use the
--   service role client, which skips RLS.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Extension (pgvector, used for knowledge-base search)
-- ---------------------------------------------------------------------
create extension if not exists vector with schema extensions;


-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------

-- One row per support ticket.
-- public_token is a random id used in the customer link (the link is the "password").
-- intent / department / priority / confidence are filled by the classify step.
create table public.tickets (
  id             uuid primary key default gen_random_uuid(),
  public_token   uuid not null unique default gen_random_uuid(),
  customer_name  text not null check (char_length(customer_name) between 1 and 100),
  customer_email text not null check (char_length(customer_email) between 5 and 200),
  subject        text not null check (char_length(subject) between 3 and 150),
  status         text not null default 'PROCESSING'
                 check (status in ('PROCESSING', 'PENDING_REVIEW', 'ESCALATED',
                                   'REPLIED', 'RESOLVED', 'FAILED')),
  intent         text,
  department     text check (department in ('customer_care', 'billing', 'engineering')),
  priority       text check (priority in ('low', 'normal', 'high', 'urgent')),
  confidence     real check (confidence between 0 and 1),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- The conversation. A customer never sees a message unless status = 'sent'.
--   author_type: customer, ai_draft (AI text a human approves), staff, system (fixed templates)
--   status     : draft (waiting for review), sent (visible to the customer), failed (send failed)
--   sources    : article titles the AI used, e.g. ["Reset your password"]
create table public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  author_type text not null check (author_type in ('customer', 'ai_draft', 'staff', 'system')),
  body        text not null check (char_length(body) between 1 and 5000),
  sources     jsonb not null default '[]',
  status      text not null default 'sent' check (status in ('draft', 'sent', 'failed')),
  created_at  timestamptz not null default now()
);

-- Audit log and timeline. It also stores review decisions and knowledge-base gaps.
--   type  examples: created, classified, kb_gap, draft_saved, escalated,
--                   approved, edited, sent, send_failed, failed, resolved, spam_marked
--   actor : staff email, or 'system'
create table public.ticket_events (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.tickets (id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}',
  actor      text not null default 'system',
  created_at timestamptz not null default now()
);

-- Knowledge base: one row per chunk (a heading section of an article).
-- Written only by the ingestion script (service role).
-- model = which embedding model made the vector (vectors from different models cannot be compared).
create table public.kb_chunks (
  id            uuid primary key default gen_random_uuid(),
  article_title text not null,
  heading       text,
  content       text not null,
  embedding     extensions.vector(768) not null,
  model         text not null,
  created_at    timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3. Indexes (primary keys and the unique public_token already have indexes)
-- ---------------------------------------------------------------------
create index tickets_status_idx           on public.tickets (status);
create index tickets_created_at_idx       on public.tickets (created_at desc);
create index tickets_email_created_idx    on public.tickets (customer_email, created_at desc); -- per-email limit
create index ticket_messages_ticket_idx   on public.ticket_messages (ticket_id, created_at);
create index ticket_events_ticket_idx     on public.ticket_events (ticket_id, created_at);
-- No vector index on purpose: exact search is fast for a few hundred chunks.


-- ---------------------------------------------------------------------
-- 4. Function: find the closest knowledge-base chunks
--    <=> is cosine distance, so 1 - distance = similarity (1 = same meaning).
-- ---------------------------------------------------------------------
create or replace function public.match_kb_chunks(
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  article_title text,
  heading text,
  content text,
  similarity float
)
language sql
stable
security invoker
as $$
  select
    k.id,
    k.article_title,
    k.heading,
    k.content,
    1 - (k.embedding <=> query_embedding) as similarity
  from public.kb_chunks k
  where 1 - (k.embedding <=> query_embedding) > match_threshold
  order by k.embedding <=> query_embedding asc
  limit least(match_count, 10);
$$;


-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.tickets         enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_events   enable row level security;
alter table public.kb_chunks       enable row level security;

-- Table privileges for logged-in staff (new Supabase projects may not grant these by default)
grant select, update         on public.tickets         to authenticated;
grant select, insert, update on public.ticket_messages to authenticated;
grant select, insert         on public.ticket_events   to authenticated;
grant select                 on public.kb_chunks       to authenticated;
-- anon (not logged in) gets nothing: no grants and no policies.

-- ---- tickets ----
-- No insert policy: tickets are created by server code (service role).
create policy "tickets: staff can read"
  on public.tickets for select to authenticated
  using (true);

create policy "tickets: staff can update"
  on public.tickets for update to authenticated
  using (true) with check (true);

-- ---- ticket_messages ----
create policy "messages: staff can read"
  on public.ticket_messages for select to authenticated
  using (true);

create policy "messages: staff can insert"
  on public.ticket_messages for insert to authenticated
  with check (true);

create policy "messages: staff can update"
  on public.ticket_messages for update to authenticated
  using (true) with check (true);

-- ---- ticket_events ----
create policy "events: staff can read"
  on public.ticket_events for select to authenticated
  using (true);

create policy "events: staff can insert"
  on public.ticket_events for insert to authenticated
  with check (true);

-- ---- kb_chunks ----
-- Staff can read. No write policy: only the ingestion script (service role) writes.
create policy "kb_chunks: staff can read"
  on public.kb_chunks for select to authenticated
  using (true);


-- ---------------------------------------------------------------------
-- 6. Checks (safe to run any time)
-- ---------------------------------------------------------------------

-- RLS must be on for every table (rowsecurity = true)
select tablename, rowsecurity from pg_tables where schemaname = 'public';

-- Must equal the number of staff accounts YOU created.
-- If it is bigger, someone signed up. Turn off sign-ups and delete the extra users.
select count(*) as number_of_users from auth.users;

-- Embedding column must be vector(768)
select format_type(a.atttypid, a.atttypmod)
from pg_attribute a
where a.attrelid = 'public.kb_chunks'::regclass and a.attname = 'embedding';
