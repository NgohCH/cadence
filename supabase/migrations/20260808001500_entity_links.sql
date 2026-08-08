-- Cadence v0.1
-- Migration: generic relationships between work-state entities

create table public.entity_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  relationship text not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, target_type, target_id, relationship)
);
