-- Cadence v0.1
-- Migration: backfill missing current Project Health records
--
-- Existing projects created before Project Health initialization
-- may not have a corresponding row in public.project_health.
--
-- This migration establishes the current health baseline for those
-- projects without creating artificial health-history events.

insert into public.project_health (
  project_id,
  health_status,
  reasons,
  source,
  changed_by
)
select
  p.id,
  'on_track',
  '[]'::jsonb,
  'system',
  null
from public.projects p
where not exists (
  select 1
  from public.project_health ph
  where ph.project_id = p.id
)
on conflict (project_id) do nothing;