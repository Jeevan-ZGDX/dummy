-- Competition Dashboard: Live external competitions tracker
-- Run this in Supabase SQL Editor to create the table

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

create index idx_competition_dashboard_status on public.competition_dashboard(competition_status);
create index idx_competition_dashboard_category on public.competition_dashboard(category);

-- Enable real-time for this table (requires Supabase project with Realtime enabled)
-- Run separately if needed:
-- alter publication supabase_realtime add table competition_dashboard;
