-- Phase 1 migration: registration source of truth for per-section HOD views.
-- Applies to the live project (idempotent).
--
-- Decision (2026-08): create student_competitions / gmail_tokens with a single
-- "Allow all ... USING (true)" policy, matching every other live table
-- (students, advisors, registrations, competition_dashboard, ...). The two
-- user_profiles-dependent "Admins can view/update" policies from the earlier
-- migration draft are intentionally NOT created; the app writes these tables
-- through the service-role client anyway.

-- ─── student_competitions ─────────────────────────────────────────────
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
drop policy if exists "Allow all on student_competitions" on public.student_competitions;
create policy "Allow all on student_competitions"
  on public.student_competitions for all using (true);

-- ─── gmail_tokens ─────────────────────────────────────────────────────
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
drop policy if exists "Allow all on gmail_tokens" on public.gmail_tokens;
create policy "Allow all on gmail_tokens"
  on public.gmail_tokens for all using (true);

-- ─── user_profiles (looked up by gmail/verify + google-auth fallbacks) ─
create table if not exists public.user_profiles (
  user_id text primary key,
  email text unique not null,
  full_name text,
  role text default 'student',
  department text default '',
  created_at timestamptz default now()
);

alter table public.user_profiles enable row level security;
drop policy if exists "Allow all on user_profiles" on public.user_profiles;
create policy "Allow all on user_profiles"
  on public.user_profiles for all using (true);

-- ─── indexes ──────────────────────────────────────────────────────────
create index if not exists idx_student_competitions_competition_id on public.student_competitions(competition_id);
create index if not exists idx_student_competitions_student_email on public.student_competitions(student_email);
create index if not exists idx_student_competitions_verification_status on public.student_competitions(verification_status);
create index if not exists idx_gmail_tokens_user_id on public.gmail_tokens(user_id);
create index if not exists idx_gmail_tokens_user_email on public.gmail_tokens(user_email);