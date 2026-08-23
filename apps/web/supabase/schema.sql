create extension if not exists "uuid-ossp";

create table if not exists public.students (
  id text primary key,
  name text not null,
  email text,
  department text not null default 'CSE',
  year text not null default '2nd Year',
  section text not null default 'A',
  registered_competitions integer not null default 0,
  verified_competitions integer not null default 0,
  created_at timestamp with time zone not null default now()
);

alter table public.students enable row level security;

create policy if not exists "Allow public read access to students"
  on public.students
  for select
  using (true);

create policy if not exists "Allow public insert access to students"
  on public.students
  for insert
  with check (true);

create policy if not exists "Allow public update access to students"
  on public.students
  for update
  using (true)
  with check (true);
