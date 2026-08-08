-- Cadence v0.1
-- Migration: project decisions and supersession chain

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null,
  description text,
  rationale text,
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'superseded', 'withdrawn')),
  decision_owner_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_by_type text not null default 'human'
    check (created_by_type in ('human', 'agent', 'system')),
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint decisions_human_creator_check check (
    created_by_type <> 'human' or created_by is not null
  )
);

create table public.decision_supersedes (
  new_decision_id uuid not null references public.decisions(id) on delete cascade,
  old_decision_id uuid not null references public.decisions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (new_decision_id, old_decision_id),
  unique (old_decision_id),
  check (new_decision_id <> old_decision_id)
);

create trigger decisions_touch_updated_at
before update on public.decisions
for each row execute function public.touch_updated_at();
