-- Cadence v0.1
-- Migration: versioned AI prompts and AI run provenance

create table public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null,
  version text not null,
  template_text text not null,
  content_sha256 text generated always as (
    encode(digest(template_text, 'sha256'), 'hex')
  ) stored,
  is_active boolean not null default false,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (prompt_key, version)
);

create unique index ai_prompt_versions_one_active_uidx
  on public.ai_prompt_versions(prompt_key)
  where is_active;

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  triggered_by_user_id uuid references public.users(id) on delete set null,
  agent_type text not null,
  model_provider text not null,
  model_name text not null,
  prompt_version_id uuid references public.ai_prompt_versions(id) on delete set null,
  correlation_id uuid not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  input_reference jsonb not null default '{}'::jsonb,
  output_raw jsonb,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
