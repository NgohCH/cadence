-- Cadence v0.1
-- Migration: idempotency registry for retried commands

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  idempotency_key text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  request_hash text,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (scope, idempotency_key)
);
