-- Cadence v0.1
-- Migration: transactional outbox / domain event stream

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_version integer not null check (event_version > 0),
  aggregate_type text not null,
  aggregate_id uuid not null,
  project_id uuid references public.projects(id) on delete cascade,
  actor_type text not null check (actor_type in ('human', 'agent', 'system')),
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  correlation_id uuid not null,
  causation_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'failed')),
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  available_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);
