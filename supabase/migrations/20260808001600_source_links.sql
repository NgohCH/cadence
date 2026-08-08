-- Cadence v0.1
-- Migration: provenance links from structured state back to source material

create table public.source_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  source_type text not null,
  source_id uuid not null,
  source_version integer,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, source_type, source_id, source_version)
);
