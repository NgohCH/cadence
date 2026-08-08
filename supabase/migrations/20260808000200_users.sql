-- Cadence v0.1
-- Migration: application users and authentication-provider mapping
-- Passwords are managed by Supabase Auth. This table stores Cadence identity only.

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  username citext not null unique,
  display_name text not null,
  email citext not null unique,
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  identity_provider text not null default 'local',
  external_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_provider_external_uidx
  on public.users(identity_provider, external_user_id)
  where external_user_id is not null;

create trigger users_touch_updated_at
before update on public.users
for each row execute function public.touch_updated_at();
