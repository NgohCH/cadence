-- Cadence v0.1
-- Migration: extensions and generic helper functions

create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_immutable_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Rows in % are immutable', tg_table_name
    using errcode = '55000';
end;
$$;

create or replace function public.prevent_hard_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Hard DELETE is disabled for %; use the module soft-delete/lifecycle command', tg_table_name
    using errcode = '55000';
end;
$$;
