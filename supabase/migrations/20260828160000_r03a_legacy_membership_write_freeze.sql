-- Cadence R03A
-- Retain and freeze the legacy project-membership compatibility fields.
--
-- R02 made stable Person membership and frozen role assignments authoritative.
-- R03A does not drop any legacy column. Historical VS-001 values remain
-- available while later R03 stages decouple the remaining generated
-- projections and prove that the compatibility shape can be retired safely.


create or replace function
  public.enforce_legacy_membership_write_freeze()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is not null
       or new.role_id is not null then
      raise exception using
        errcode = '55000',
        message =
          'R03A_NEW_LEGACY_MEMBERSHIP_SHAPE_FORBIDDEN';
    end if;

    return new;
  end if;


  if new.user_id is distinct from old.user_id
     or new.role_id is distinct from old.role_id
     or new.joined_at is distinct from old.joined_at
     or new.created_by is distinct from old.created_by then
    raise exception using
      errcode = '55000',
      message =
        'R03A_LEGACY_MEMBERSHIP_HISTORY_IMMUTABLE';
  end if;


  return new;
end;
$$;


drop trigger if exists
  project_memberships_freeze_legacy_fields
on public.project_memberships;

create trigger
  project_memberships_freeze_legacy_fields
before insert or update
on public.project_memberships
for each row execute function
  public.enforce_legacy_membership_write_freeze();


revoke all on function
  public.enforce_legacy_membership_write_freeze()
from public, anon, authenticated;


comment on function
  public.enforce_legacy_membership_write_freeze()
is
  'R03A guard: preserves historical VS-001 membership compatibility values, rejects new legacy-shaped rows, and prevents rewriting legacy identity, role, start, or grantor provenance.';

comment on column
  public.project_memberships.user_id
is
  'Deprecated, retained VS-001 membership identity. R03A freezes historical values; stable membership identity uses person_id.';

comment on column
  public.project_memberships.role_id
is
  'Deprecated, retained VS-001 membership role. R03A freezes historical values; authority uses project_role_assignments.';

comment on column
  public.project_memberships.joined_at
is
  'Deprecated, retained VS-001 start timestamp. R03A freezes historical values; effective_from remains its generated compatibility projection until R03B.';

comment on column
  public.project_memberships.created_by
is
  'Deprecated, retained VS-001 grantor reference. R03A freezes historical values; stable provenance uses granted_by_person_id.';

comment on column
  public.project_memberships.status
is
  'Retained VS-001 lifecycle source. membership_status remains its generated compatibility projection until R03B; lifecycle RPCs may still update this field.';


/*
 * Deployment postconditions. These validate the staged boundary without
 * rewriting or deleting any historical membership value.
 */
do $$
begin
  if exists (
    select 1
    from public.project_memberships
    where
      (user_id is null) <>
      (role_id is null)
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R03A_LEGACY_MEMBERSHIP_PAIR_INVALID';
  end if;


  if not exists (
    select 1
    from pg_trigger
    where tgrelid =
        'public.project_memberships'::regclass
      and tgname =
        'project_memberships_freeze_legacy_fields'
      and not tgisinternal
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R03A_LEGACY_MEMBERSHIP_FREEZE_MISSING';
  end if;
end;
$$;
