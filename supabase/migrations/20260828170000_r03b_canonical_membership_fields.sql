-- Cadence R03B
-- Remove domain dependence on retained VS-001 joined_at and status fields.
--
-- This migration deliberately retains user_id, role_id, joined_at, status,
-- and created_by. Physical legacy-column removal remains R03D.


do $$
begin
  if exists (
    select 1
    from public.project_memberships
    where effective_from is distinct from joined_at
       or membership_status is distinct from
          case status
            when 'active' then 'ACTIVE'
            when 'inactive' then 'ENDED'
          end
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R03B_GENERATED_MEMBERSHIP_PROJECTION_MISMATCH';
  end if;
end;
$$;


alter table public.project_memberships
  alter column effective_from drop expression,
  alter column membership_status drop expression;

alter table public.project_memberships
  alter column effective_from set not null,
  alter column membership_status set not null,
  add constraint project_memberships_membership_status_check
    check (membership_status in ('ACTIVE', 'ENDED'));


/*
 * Recreate the three state helpers from their live definitions with guarded,
 * minimal replacements. This retains their validation, locking, history,
 * provenance, idempotency, and return contracts while moving only the
 * membership start/lifecycle authority to the canonical columns.
 */
do $$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.vs002_07_add_project_member_state(uuid,uuid,uuid,timestamptz,timestamptz,uuid,timestamptz,uuid,uuid,timestamptz)'::regprocedure
  )
  into v_definition;

  v_original := v_definition;

  v_definition := replace(
    v_definition,
    E'existing_membership.status =\n        ''active''',
    E'existing_membership.membership_status =\n        ''ACTIVE'''
  );

  v_definition := replace(
    v_definition,
    E'    user_id,\n    role_id,\n    status,\n    joined_at,\n    person_id,',
    E'    person_id,\n    effective_from,\n    membership_status,'
  );

  v_definition := replace(
    v_definition,
    E'    null,\n    null,\n    ''active'',\n    p_effective_from,\n    p_person_id,',
    E'    p_person_id,\n    p_effective_from,\n    ''ACTIVE'','
  );

  if v_definition = v_original
     or v_definition ilike '%existing_membership.status%'
     or v_definition ilike '%joined_at%'
     or v_definition ~ E'\\n[[:space:]]+status,[[:space:]]*\\n'
  then
    raise exception using
      errcode = '55000',
      message =
        'R03B_ADMISSION_HELPER_RECONCILIATION_FAILED';
  end if;

  execute v_definition;


  select pg_get_functiondef(
    'public.vs002_07_terminate_membership_state(uuid,uuid,timestamptz,uuid,text,uuid)'::regprocedure
  )
  into v_definition;

  v_original := v_definition;
  v_definition := replace(
    v_definition,
    E'    status = ''inactive'',\n    effective_to = p_effective_at,',
    E'    membership_status = ''ENDED'',\n    effective_to = p_effective_at,'
  );

  if v_definition = v_original
     or v_definition ~ E'\\n[[:space:]]+status[[:space:]]*='
  then
    raise exception using
      errcode = '55000',
      message =
        'R03B_TERMINATION_HELPER_RECONCILIATION_FAILED';
  end if;

  execute v_definition;


  select pg_get_functiondef(
    'public.vs002_07_finalize_expiry_state(uuid,uuid,timestamptz,text,uuid)'::regprocedure
  )
  into v_definition;

  v_original := v_definition;
  v_definition := replace(
    v_definition,
    E'    status = ''inactive'',\n    termination_kind = ''EXPIRY'',',
    E'    membership_status = ''ENDED'',\n    termination_kind = ''EXPIRY'','
  );

  if v_definition = v_original
     or v_definition ~ E'\\n[[:space:]]+status[[:space:]]*='
  then
    raise exception using
      errcode = '55000',
      message =
        'R03B_EXPIRY_HELPER_RECONCILIATION_FAILED';
  end if;

  execute v_definition;
end;
$$;


/* R03A history protection now includes the retired lifecycle source. */
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
     or new.status is distinct from old.status
     or new.created_by is distinct from old.created_by then
    raise exception using
      errcode = '55000',
      message =
        'R03A_LEGACY_MEMBERSHIP_HISTORY_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function
  public.enforce_legacy_membership_write_freeze()
from public, anon, authenticated;


/* Retire schema objects that still interpret legacy status as authority. */
drop index if exists
  public.project_memberships_active_user_project_uidx;

drop index if exists
  public.project_memberships_project_status_idx;

drop index if exists
  public.project_memberships_user_status_idx;

alter table public.project_memberships
  drop constraint if exists
    project_memberships_status_check;


comment on column
  public.project_memberships.effective_from
is
  'Canonical Project Membership start boundary. R03B detached this field from retained legacy joined_at.';

comment on column
  public.project_memberships.membership_status
is
  'Canonical ACTIVE/ENDED Project Membership lifecycle. R03B detached this field from retained legacy status.';

comment on column
  public.project_memberships.joined_at
is
  'Deprecated, retained and immutable VS-001 start value. It is not a Project Membership domain authority after R03B.';

comment on column
  public.project_memberships.status
is
  'Deprecated, retained and immutable VS-001 lifecycle value. It is not a Project Membership domain authority after R03B.';


/* Live postconditions: dependency removal, retention, and R03A preservation. */
do $$
declare
  v_dependency text;
begin
  if exists (
    select 1
    from pg_attribute
    where attrelid =
        'public.project_memberships'::regclass
      and attname in (
        'effective_from',
        'membership_status'
      )
      and attgenerated <> ''
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R03B_CANONICAL_COLUMN_STILL_GENERATED';
  end if;

  if exists (
    select 1
    from pg_attribute
    where attrelid =
        'public.project_memberships'::regclass
      and attname in (
        'effective_from',
        'membership_status'
      )
      and not attnotnull
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R03B_CANONICAL_COLUMN_NULLABLE';
  end if;

  select string_agg(indexname, ', ' order by indexname)
  into v_dependency
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'project_memberships'
    and indexdef ~
      '(^|[^a-z_])status([^a-z_]|$)';

  if v_dependency is not null then
    raise exception using
      errcode = '55000',
      message =
        'R03B_LEGACY_STATUS_INDEX_REMAINS',
      detail = v_dependency;
  end if;

  select string_agg(conname, ', ' order by conname)
  into v_dependency
  from pg_constraint
  where conrelid =
      'public.project_memberships'::regclass
    and pg_get_constraintdef(oid) ~
      '(^|[^a-z_])status([^a-z_]|$)';

  if v_dependency is not null then
    raise exception using
      errcode = '55000',
      message =
        'R03B_LEGACY_STATUS_CONSTRAINT_REMAINS',
      detail = v_dependency;
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname =
        'enforce_legacy_membership_write_freeze'
      and p.prosrc ilike
        '%new.status is distinct from old.status%'
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R03B_R03A_STATUS_FREEZE_MISSING';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'vs002_07_add_project_member_state',
        'vs002_07_terminate_membership_state',
        'vs002_07_finalize_expiry_state'
      )
      and (
        p.prosrc ilike '%joined_at%'
        or p.prosrc ilike
          '%existing_membership.status%'
        or p.prosrc ~
          E'\\n[[:space:]]+status[[:space:]]*='
      )
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R03B_LEGACY_STATE_HELPER_DEPENDENCY_REMAINS';
  end if;

  if exists (
    select required.attname
    from unnest(array[
      'user_id',
      'role_id',
      'joined_at',
      'status',
      'created_by'
    ]) as required(attname)
    where not exists (
      select 1
      from pg_attribute actual
      where actual.attrelid =
          'public.project_memberships'::regclass
        and actual.attname = required.attname
        and not actual.attisdropped
    )
  ) then
    raise exception using
      errcode = '55000',
      message =
        'R03B_LEGACY_MEMBERSHIP_COLUMN_MISSING';
  end if;
end;
$$;
