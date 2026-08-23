-- Comp-Dash: Full Supabase Schema
-- Run this in Supabase SQL Editor to create all tables
--
-- RECONCILIATION NOTES (2026-08): this file is kept in sync with the LIVE
-- project. Known divergences from a from-scratch run:
--  * `competitions` is legacy/in-memory only (the live DB has NO competitions
--    table; competition data lives in competition_dashboard).
--  * `profiles` was removed from the live project; the app reads/writes
--    user_profiles instead (gmail/verify, google-auth fallback).
--  * student_competitions / gmail_tokens use a single "Allow all USING (true)"
--    policy (matching every other live table) rather than the earlier
--    user_profiles-dependent staff policies.

-- Students table
create table if not exists students (
  id text primary key,
  name text not null,
  email text unique not null,
  department text default 'CSE',
  year text default '2nd Year',
  section text default 'A',
  roll_number text,
  phone text,
  registered_competitions integer default 0,
  verified_competitions integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Advisors table
create table if not exists advisors (
  id text primary key,
  name text not null,
  email text unique not null,
  department text default 'CSE',
  assigned_sections text[] default '{}',
  pending_verifications integer default 0,
  phone text,
  office_location text,
  experience integer default 0,
  publications integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Competitions table
create table if not exists competitions (
  id text primary key,
  title text not null,
  description text default '',
  short_description text default '',
  category text not null,
  scope text not null,
  mode text not null,
  organizer text not null,
  organizer_logo text,
  banner_url text,
  website_url text default '',
  registration_url text default '',
  team_size_min integer default 1,
  team_size_max integer default 1,
  prize_pool text default '',
  registration_deadline timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  eligibility jsonb default '{}',
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Registrations table
-- NOTE: live table additionally stores denormalized competition fields
-- (competition_name … organizer) that are NOT declared here.
create table if not exists registrations (
  id text primary key,
  competition_id text references competitions(id) on delete cascade,
  user_id text references students(id) on delete cascade,
  user_name text not null,
  department text default 'CSE',
  status text default 'pending_verification',
  registered_at timestamptz default now(),
  verified_at timestamptz,
  verification_method text,
  extracted_confirmation_id text,
  extracted_email text,
  rejection_reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table registrations enable row level security;
create policy "Allow all on registrations" on registrations for all using (true);

-- Winners table
create table if not exists winners (
  id text primary key,
  student_name text not null,
  email text not null,
  competition text not null,
  competition_id text references competitions(id) on delete set null,
  department text default 'CSE',
  position text default '',
  prize text default '',
  date date,
  verification_date timestamptz,
  registration_id text references registrations(id) on delete set null,
  created_at timestamptz default now()
);

-- Audit logs table
create table if not exists audit_logs (
  id text primary key,
  timestamp timestamptz default now(),
  "user" text not null,
  action text not null,
  resource text not null,
  details text default ''
);

-- Notifications table
create table if not exists notifications (
  id text primary key,
  user_id text not null,
  type text not null,
  title text not null,
  message text not null,
  data jsonb,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Verification requests table
create table if not exists verification_requests (
  id text primary key,
  registration_id text references registrations(id) on delete cascade,
  student_id text references students(id) on delete cascade,
  student_name text not null,
  department text default 'CSE',
  competition_title text default '',
  advisor_notified boolean default false,
  email_proof text,
  status text default 'pending',
  requested_at timestamptz default now(),
  reviewed_at timestamptz
);

-- Role access table
create table if not exists role_access (
  email text primary key,
  role text not null,
  department text default 'CSE',
  granted boolean default false,
  updated_at timestamptz default now()
);

-- Indexes for performance
create index idx_students_department on students(department);
create index idx_students_year on students(year);
create index idx_students_section on students(section);
create index idx_advisors_department on advisors(department);
create index idx_competitions_category on competitions(category);
create index idx_competitions_scope on competitions(scope);
create index idx_registrations_status on registrations(status);
create index idx_registrations_user on registrations(user_id);
create index idx_notifications_user on notifications(user_id);

-- Enable RLS (Row Level Security) — disable if using service role
alter table students enable row level security;
alter table advisors enable row level security;
alter table competitions enable row level security;
alter table registrations enable row level security;
alter table winners enable row level security;
alter table audit_logs enable row level security;
alter table notifications enable row level security;
alter table verification_requests enable row level security;
alter table role_access enable row level security;

-- Policies: allow all operations for anon/service role (dev mode)
create policy "Allow all on students" on students for all using (true);
create policy "Allow all on advisors" on advisors for all using (true);
create policy "Allow all on competitions" on competitions for all using (true);
create policy "Allow all on registrations" on registrations for all using (true);
create policy "Allow all on winners" on winners for all using (true);
create policy "Allow all on audit_logs" on audit_logs for all using (true);
create policy "Allow all on notifications" on notifications for all using (true);
create policy "Allow all on verification_requests" on verification_requests for all using (true);
create policy "Allow all on role_access" on role_access for all using (true);

-- ─── Supabase Auth integration ──────────────────────────────────────
-- Mirrors auth.users for app-level profile data. The auth trigger below
-- auto-creates a row whenever a user signs up (or is created via seed:auth).

-- ─── Gmail OAuth tokens (server-only; read via service role) ───────
create table if not exists public.gmail_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  user_email text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  history_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.gmail_tokens enable row level security;

-- The web app reads/writes tokens with the service role (bypasses RLS).
-- Open to all (matches every other live table).
create policy "Allow all on gmail_tokens"
  on public.gmail_tokens for all using (true);

-- ─── Competition dashboard (external tracker) ──────────────────────
create table if not exists public.competition_dashboard (
  id text primary key,
  serial_no integer not null,
  competition_name text not null,
  competition_status text not null default 'On Going',
  eligible_year text not null,
  reg_deadline date,
  r1_date date,
  r2_date date,
  remaining_days_for_reg integer,
  r_days_for_r1 integer,
  r_days_for_r2 integer,
  reg_team integer not null default 0,
  total_prize_amount text not null default '',
  category text not null default 'Competition',
  organizer text not null,
  website_url text not null default '',
  registration_link text not null default '',
  description text not null default '',
  short_description text not null default '',
  scope text not null default 'national',
  mode text not null default 'online',
  organizer_email text not null default '',
  team_size_min integer not null default 1,
  team_size_max integer not null default 1,
  tags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.competition_dashboard enable row level security;
create policy "Allow all on competition_dashboard" on public.competition_dashboard for all using (true);

-- ─── Student competition registrations & verification ──────────────
create table if not exists public.student_competitions (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  student_email text not null,
  student_name text not null,
  competition_id text not null,
  competition_name text not null,
  registration_link text,
  verification_status text default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verification_method text,
  gmail_message_id text,
  gmail_thread_id text,
  verified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (student_email, competition_id)
);

alter table public.student_competitions enable row level security;

-- Open to all (matches every other live table). The earlier
-- user_profiles-dependent "Staff can view/update" policies are intentionally
-- dropped; the app writes/reads this table via the service role.
create policy "Allow all on student_competitions"
  on public.student_competitions for all using (true);

-- ─── User profiles (legacy mirror, used by gmail verification) ─────
create table if not exists public.user_profiles (
  user_id text primary key,
  email text unique not null,
  full_name text,
  role text default 'student',
  department text default '',
  created_at timestamptz default now()
);

alter table public.user_profiles enable row level security;
create policy "Allow public read access to user_profiles" on public.user_profiles for select using (true);
create policy "Allow all on user_profiles" on public.user_profiles for all using (true);

-- Indexes for new tables
create index if not exists idx_gmail_tokens_user_id on public.gmail_tokens(user_id);
create index if not exists idx_gmail_tokens_user_email on public.gmail_tokens(user_email);
create index if not exists idx_student_competitions_student_email on public.student_competitions(student_email);
create index if not exists idx_student_competitions_competition_id on public.student_competitions(competition_id);
create index if not exists idx_student_competitions_verification_status on public.student_competitions(verification_status);
create index if not exists idx_competition_dashboard_status on public.competition_dashboard(competition_status);
create index if not exists idx_competition_dashboard_category on public.competition_dashboard(category);
