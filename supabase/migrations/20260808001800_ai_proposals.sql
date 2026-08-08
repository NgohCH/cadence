-- Cadence v0.1
-- Migration: human-reviewable AI proposals

create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  ai_run_id uuid not null references public.ai_runs(id) on delete cascade,
  proposal_type text not null
    check (proposal_type in ('task', 'decision', 'blocker', 'topic', 'project_health')),
  payload jsonb not null,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'edited', 'rejected', 'expired')),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  result_entity_type text,
  result_entity_id uuid,
  created_at timestamptz not null default now(),
  constraint ai_proposals_review_check check (
    status in ('pending', 'expired') or reviewed_by is not null
  )
);
