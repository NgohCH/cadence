-- Cadence v0.1
-- Migration: append-only operational audit trail

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  correlation_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  actor_type text not null check (actor_type in ('human', 'agent', 'system')),
  actor_id uuid,
  actor_role text,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  source_type text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create trigger audit_events_immutable
before update or delete on public.audit_events
for each row execute function public.prevent_immutable_mutation();
