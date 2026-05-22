create table if not exists public.app_users (
  id uuid primary key,
  alias text not null check (char_length(alias) between 2 and 40),
  role text not null check (role in ('user', 'admin', 'staff', 'judge', 'competitor')),
  status text not null check (status in ('inactive', 'active')),
  created_at timestamptz not null default now(),
  last_check_in_at timestamptz,
  last_check_out_at timestamptz
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
