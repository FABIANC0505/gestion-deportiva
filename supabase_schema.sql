create table if not exists public.app_users (
  id uuid primary key,
  alias text not null check (char_length(alias) between 2 and 40),
  role text not null check (role in ('user', 'admin', 'staff', 'judge', 'competitor')),
  status text not null check (status in ('inactive', 'active')),
  created_at timestamptz not null default now(),
  last_check_in_at timestamptz,
  last_check_out_at timestamptz,
  username text unique,
  password_hash text,
  weight numeric,
  category text
);

create table if not exists public.attendance_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  action text not null check (action in ('check-in', 'check-out')),
  timestamp timestamptz not null default now(),
  scanned_by uuid references public.app_users(id) on delete set null,
  reason text
);

create index if not exists idx_app_users_status_role
  on public.app_users(status, role);

create index if not exists idx_attendance_logs_user_time
  on public.attendance_logs(user_id, timestamp desc);

-- MIGRATION STATEMENTS FOR EXISTING DATABASE (Run in Supabase SQL Editor if table already exists):
-- alter table public.app_users add column if not exists username text unique;
-- alter table public.app_users add column if not exists password_hash text;
-- alter table public.app_users add column if not exists weight numeric;
-- alter table public.app_users add column if not exists category text;
--
-- update public.app_users
-- set username = 'admin',
--     password_hash = '$2b$12$TlIs1eapV2vpwzmx/1b1BubM1UBKvcUMK2GDbzFt.qOJhvRFNYfga'
-- where alias = 'MasterAdmin' and username is null;

