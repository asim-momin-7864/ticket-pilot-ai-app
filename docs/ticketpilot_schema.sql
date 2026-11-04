-- =====================================================================
-- TicketPilot AI - FINAL REFERENCE SCHEMA (Supabase / Postgres)
--
-- Built from what the app code reads and writes. Use it to:
--   1) read and learn the database in one place, or
--   2) create a fresh Supabase project.
--
-- If you run it on your EXISTING database, run it in a new/empty project
-- instead, or read it only. Your seed.sql must use the same column names.
-- To get the exact schema of your running database, see the bottom of
-- this file (section 10).
-- =====================================================================


-- 0. EXTENSIONS ------------------------------------------------------
-- pgvector stores the embeddings (numbers that describe the meaning of text)
create extension if not exists vector with schema extensions;


-- 1. PROFILES (staff only) -------------------------------------------
-- One row per staff user. The id is the same as the Supabase Auth user id.
-- Customers have NO row here. Read by src/lib/require-staff.ts
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        text not null default 'AGENT' check (role in ('ADMIN', 'AGENT')),
  created_at  timestamptz not null default now()
);


-- 2. TICKETS ---------------------------------------------------------
-- ref          human friendly id like TCK-1001 (made by the sequence)
-- public_token secret id used in the customer link /support/<token>
create sequence if not exists public.ticket_ref_seq start 1001;

create table if not exists public.tickets (
  id                uuid primary key default gen_random_uuid(),
  ref               text not null unique default ('TCK-' || nextval('public.ticket_ref_seq')),
  public_token      uuid not null unique default gen_random_uuid(),
  customer_name     text not null,
  customer_email    text not null,
  subject           text not null,
  status            text not null default 'PROCESSING'
                    check (status in ('PROCESSING', 'PENDING_REVIEW', 'ESCALATED',
                                      'REPLIED', 'RESOLVED', 'FAILED')),
  -- filled by the agent (src/lib/agent/classify.ts). Checked by Zod in code.
  intent            text,
  department        text,   -- customer_care, engineering, billing
  priority          text,
  confidence        numeric,
  escalation_reason text,   -- risky_intent:REFUND, account_specific, low_confidence ...
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists tickets_status_created_idx on public.tickets (status, created_at desc);
create index if not exists tickets_department_idx     on public.tickets (department);
create index if not exists tickets_email_created_idx  on public.tickets (customer_email, created_at desc);


-- 3. TICKET MESSAGES -------------------------------------------------
-- author_type: customer | ai_draft | staff
-- status:      draft (AI draft, never shown to the customer) | sent (visible)
-- sources:     list like [{ "id": "...", "title": "...", "section": "..." }]
create table if not exists public.ticket_messages (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.tickets (id) on delete cascade,
  author_type  text not null check (author_type in ('customer', 'ai_draft', 'staff')),
  body         text not null,
  status       text not null default 'sent' check (status in ('draft', 'sent')),
  sources      jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);


-- 4. TICKET EVENTS ---------------------------------------------------
-- Audit log AND the "agent trace" shown on the staff ticket page.
-- Types used by the code:
--   created, run_started, draft_ready, kb_gap, escalated, run_failed,
--   rerun_requested, approved, edited,
--   email_sent, email_preview, send_failed, slack_posted, notify_failed
-- actor: 'system', 'customer', or the staff email
create table if not exists public.ticket_events (
  id          bigint generated always as identity primary key,
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  type        text not null,
  actor       text not null default 'system',
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists ticket_events_ticket_idx on public.ticket_events (ticket_id, created_at);
create index if not exists ticket_events_type_idx   on public.ticket_events (type);


-- 5. KNOWLEDGE BASE --------------------------------------------------
-- Help articles split into small pieces (chunks). Each chunk has an embedding.
-- The vector size (768) MUST match EMBEDDING_DIM in .env.local.
create table if not exists public.kb_chunks (
  id             uuid primary key default gen_random_uuid(),
  article_title  text not null,
  heading        text not null default '',
  content        text not null,
  collection     text,
  visibility     text not null default 'public' check (visibility in ('public', 'internal')),
  status         text not null default 'current' check (status in ('current', 'superseded')),
  embedding      extensions.vector(768),
  content_hash   text,
  created_at     timestamptz not null default now()
);

-- Optional: a vector index. Not needed for a few hundred rows.
-- create index kb_chunks_embedding_idx on public.kb_chunks
--   using hnsw (embedding extensions.vector_cosine_ops);


-- 6. HELPER FUNCTIONS ------------------------------------------------
-- "Is the current user staff?" Used by the RLS policies below.
-- security definer = runs with the owner's rights, so it can read profiles
-- without the policy calling itself again (no infinite recursion).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('ADMIN', 'AGENT')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

-- Search the knowledge base by meaning. Called by src/lib/agent/retrieve.ts
-- similarity = 1 - cosine distance (1 means identical meaning)
-- Only PUBLIC and CURRENT chunks are returned, so internal notes never reach customers.
create or replace function public.match_kb_chunks(
  query_embedding  extensions.vector(768),
  match_threshold  double precision,
  match_count      integer
)
returns table (
  id             uuid,
  article_title  text,
  heading        text,
  content        text,
  similarity     double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id,
    c.article_title,
    c.heading,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.kb_chunks c
  where c.visibility = 'public'
    and c.status = 'current'
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;


-- 7. DASHBOARD VIEWS -------------------------------------------------
-- security_invoker = the view runs with the CALLER's rights, so RLS applies.
create or replace view public.dashboard_by_department
with (security_invoker = true) as
select
  coalesce(department, 'unclassified') as department,
  count(*)                              as total,
  count(*) filter (
    where status in ('PROCESSING', 'PENDING_REVIEW', 'ESCALATED', 'FAILED')
  )                                     as open
from public.tickets
group by 1;

-- What staff did with AI drafts: approved as is, edited, or escalated by a person.
-- 'escalated' by the system (policy gate) is NOT counted here.
create or replace view public.dashboard_review_outcomes
with (security_invoker = true) as
select
  case type
    when 'approved' then 'approved'
    when 'edited'   then 'edited'
    else 'escalated'
  end        as outcome,
  count(*)   as total
from public.ticket_events
where type in ('approved', 'edited')
   or (type = 'escalated' and actor <> 'system')
group by 1;


-- 8. ROW LEVEL SECURITY ----------------------------------------------
-- Rule: only staff can READ through the normal (user) client.
-- All WRITES from the app use the service role key on the server
-- (supabaseAdmin), which skips RLS. So there are no insert/update policies.
alter table public.profiles         enable row level security;
alter table public.tickets          enable row level security;
alter table public.ticket_messages  enable row level security;
alter table public.ticket_events    enable row level security;
alter table public.kb_chunks        enable row level security;

drop policy if exists "profiles read own"        on public.profiles;
drop policy if exists "tickets staff read"       on public.tickets;
drop policy if exists "messages staff read"      on public.ticket_messages;
drop policy if exists "events staff read"        on public.ticket_events;
drop policy if exists "kb staff read"            on public.kb_chunks;

-- A logged-in user can read ONLY their own profile row (needed by requireStaff)
create policy "profiles read own" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "tickets staff read" on public.tickets
  for select to authenticated using (public.is_staff());

create policy "messages staff read" on public.ticket_messages
  for select to authenticated using (public.is_staff());

create policy "events staff read" on public.ticket_events
  for select to authenticated using (public.is_staff());

create policy "kb staff read" on public.kb_chunks
  for select to authenticated using (public.is_staff());


-- 9. PERMISSIONS -----------------------------------------------------
-- Visitors who are not logged in (anon) get nothing.
revoke all on public.profiles, public.tickets, public.ticket_messages,
              public.ticket_events, public.kb_chunks
  from anon;

-- Logged in users may only read (RLS then limits it to staff).
revoke insert, update, delete, truncate on public.profiles, public.tickets,
              public.ticket_messages, public.ticket_events, public.kb_chunks
  from authenticated;

grant select on public.dashboard_by_department   to authenticated;
grant select on public.dashboard_review_outcomes to authenticated;
revoke all   on public.dashboard_by_department   from anon;
revoke all   on public.dashboard_review_outcomes from anon;

-- Only the server (service role) may search the knowledge base.
revoke execute on function public.match_kb_chunks(extensions.vector, double precision, integer)
  from public, anon, authenticated;
grant  execute on function public.match_kb_chunks(extensions.vector, double precision, integer)
  to service_role;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;


-- 10. HOW TO MAKE THE FIRST STAFF USER -------------------------------
-- 1) Supabase dashboard -> Authentication -> Users -> Add user (email + password)
-- 2) Copy that user's id, then run:
--
-- insert into public.profiles (id, full_name, role)
-- values ('<paste-user-id-here>', 'Demo Staff', 'ADMIN');
--
-- 3) Turn off public sign-ups in Authentication settings.


-- 11. TO SEE THE REAL SCHEMA OF YOUR RUNNING DATABASE ----------------
-- Run this in the SQL Editor and compare with this file:
--
-- select table_name, column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public'
-- order by table_name, ordinal_position;
--
-- Or with the Supabase CLI:  supabase db dump --schema public -f schema_real.sql
