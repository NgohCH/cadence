-- Cadence v0.1
-- Migration: file metadata and generic entity links
-- Binary content remains in the configured object-storage provider.

create table public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  filename text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  storage_provider text not null default 'supabase',
  storage_bucket text not null,
  storage_path text not null,
  uploaded_by uuid references public.users(id) on delete set null,
  checksum_sha256 text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  unique (storage_provider, storage_bucket, storage_path)
);

create table public.file_links (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (file_id, entity_type, entity_id)
);

create trigger files_prevent_hard_delete
before delete on public.files
for each row execute function public.prevent_hard_delete();
