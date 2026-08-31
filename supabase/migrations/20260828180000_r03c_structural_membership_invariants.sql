-- Cadence R03C
-- Structural enforcement for canonical Project Membership invariants.
--
-- Retained VS-001 membership columns remain present and immutable. Physical
-- legacy-column removal remains separately approved R03D work.


create extension if not exists btree_gist
  with schema extensions;


/* Refuse deployment over canonical state that the new structure cannot keep. */
do $$
declare
  v_violation text;
begin
  select format('%s/%s', first_membership.id, second_membership.id)
  into v_violation
  from public.project_memberships first_membership
  join public.project_memberships second_membership
    on first_membership.id < second_membership.id
   and first_membership.project_id = second_membership.project_id
   and first_membership.person_id = second_membership.person_id
   and tstzrange(
         first_membership.effective_from,
         first_membership.effective_to,
         '[)'
       ) && tstzrange(
         second_membership.effective_from,
         second_membership.effective_to,
         '[)'
       )
  limit 1;

  if v_violation is not null then
    raise exception using
      errcode = '55000',
      message = 'R03C_MEMBERSHIP_OVERLAP_PREFLIGHT_FAILED',
      detail = v_violation;
  end if;

  select assignment.id::text
  into v_violation
  from public.project_role_assignments assignment
  join public.project_memberships membership
    on membership.id = assignment.membership_id
   and membership.project_id = assignment.project_id
  where assignment.effective_from < membership.effective_from
     or (
       membership.effective_to is not null
       and (
         assignment.effective_to is null
         or assignment.effective_to > membership.effective_to
       )
     )
  limit 1;

  if v_violation is not null then
    raise exception using
      errcode = '55000',
      message = 'R03C_ROLE_PERIOD_PREFLIGHT_FAILED',
      detail = v_violation;
  end if;

  select format('%s/%s', first_assignment.id, second_assignment.id)
  into v_violation
  from public.project_role_assignments first_assignment
  join public.project_role_assignments second_assignment
    on first_assignment.id < second_assignment.id
   and first_assignment.membership_id = second_assignment.membership_id
   and first_assignment.role in (
     'PROJECT_MEMBER',
     'PROJECT_OBSERVER',
     'PROJECT_AUDITOR'
   )
   and second_assignment.role in (
     'PROJECT_MEMBER',
     'PROJECT_OBSERVER',
     'PROJECT_AUDITOR'
   )
   and tstzrange(
         first_assignment.effective_from,
         first_assignment.effective_to,
         '[)'
       ) && tstzrange(
         second_assignment.effective_from,
         second_assignment.effective_to,
         '[)'
       )
  limit 1;

  if v_violation is not null then
    raise exception using
      errcode = '55000',
      message = 'R03C_ORDINARY_ROLE_OVERLAP_PREFLIGHT_FAILED',
      detail = v_violation;
  end if;

  select format('%s/%s', first_assignment.id, second_assignment.id)
  into v_violation
  from public.project_role_assignments first_assignment
  join public.project_role_assignments second_assignment
    on first_assignment.id < second_assignment.id
   and first_assignment.project_id = second_assignment.project_id
   and first_assignment.role = second_assignment.role
   and first_assignment.role in (
     'PROJECT_SPONSOR',
     'PROJECT_OWNER',
     'PROJECT_MANAGER'
   )
   and tstzrange(
         first_assignment.effective_from,
         first_assignment.effective_to,
         '[)'
       ) && tstzrange(
         second_assignment.effective_from,
         second_assignment.effective_to,
         '[)'
       )
  limit 1;

  if v_violation is not null then
    raise exception using
      errcode = '55000',
      message = 'R03C_PROTECTED_ROLE_OVERLAP_PREFLIGHT_FAILED',
      detail = v_violation;
  end if;

  select transfer.id::text
  into v_violation
  from public.project_role_transfers transfer
  join public.project_role_assignments incoming
    on incoming.id = transfer.incoming_assignment_id
  left join public.project_role_assignments outgoing
    on outgoing.id = transfer.outgoing_assignment_id
  where incoming.effective_from is distinct from transfer.effective_at
     or incoming.assigned_by_person_id is distinct from
        transfer.authorised_by_person_id
     or incoming.change_reason is distinct from transfer.reason
     or incoming.created_at is distinct from transfer.created_at
     or (
       outgoing.id is not null
       and outgoing.effective_to is distinct from transfer.effective_at
     )
  limit 1;

  if v_violation is not null then
    raise exception using
      errcode = '55000',
      message = 'R03C_TRANSFER_HISTORY_PREFLIGHT_FAILED',
      detail = v_violation;
  end if;

  select assignment.id::text
  into v_violation
  from public.project_role_assignments assignment
  where assignment.role in (
      'PROJECT_SPONSOR',
      'PROJECT_OWNER',
      'PROJECT_MANAGER'
    )
    and not exists (
      select 1
      from public.project_role_transfers transfer
      where transfer.incoming_assignment_id = assignment.id
    )
  limit 1;

  if v_violation is not null then
    raise exception using
      errcode = '55000',
      message = 'R03C_PROTECTED_ROLE_LEDGER_PREFLIGHT_FAILED',
      detail = v_violation;
  end if;

  select membership.id::text
  into v_violation
  from public.project_memberships membership
  where not (
      membership.user_id is not null
      and membership.membership_status = 'ENDED'
    )
    and (
      select range_agg(
        tstzrange(
          assignment.effective_from,
          assignment.effective_to,
          '[)'
        )
      )
      from public.project_role_assignments assignment
      where assignment.membership_id = membership.id
        and assignment.project_id = membership.project_id
        and assignment.role in (
          'PROJECT_MEMBER',
          'PROJECT_OBSERVER',
          'PROJECT_AUDITOR'
        )
    ) is distinct from tstzmultirange(
      tstzrange(
        membership.effective_from,
        membership.effective_to,
        '[)'
      )
    )
  limit 1;

  if v_violation is not null then
    raise exception using
      errcode = '55000',
      message = 'R03C_ORDINARY_ROLE_COVERAGE_PREFLIGHT_FAILED',
      detail = v_violation;
  end if;

  select transfer.incoming_assignment_id::text
  into v_violation
  from public.project_role_transfers transfer
  group by transfer.incoming_assignment_id
  having count(*) > 1
  limit 1;

  if v_violation is not null then
    raise exception using
      errcode = '55000',
      message = 'R03C_TRANSFER_INCOMING_REUSE_PREFLIGHT_FAILED',
      detail = v_violation;
  end if;

  select transfer.outgoing_assignment_id::text
  into v_violation
  from public.project_role_transfers transfer
  where transfer.outgoing_assignment_id is not null
  group by transfer.outgoing_assignment_id
  having count(*) > 1
  limit 1;

  if v_violation is not null then
    raise exception using
      errcode = '55000',
      message = 'R03C_TRANSFER_OUTGOING_REUSE_PREFLIGHT_FAILED',
      detail = v_violation;
  end if;
end;
$$;


alter table public.project_memberships
  add constraint project_memberships_person_project_period_excl
  exclude using gist (
    project_id with =,
    person_id with =,
    tstzrange(effective_from, effective_to, '[)') with &&
  );

alter table public.project_role_assignments
  add constraint project_role_assignments_ordinary_period_excl
  exclude using gist (
    membership_id with =,
    tstzrange(effective_from, effective_to, '[)') with &&
  )
  where (role in (
    'PROJECT_MEMBER',
    'PROJECT_OBSERVER',
    'PROJECT_AUDITOR'
  ));

alter table public.project_role_assignments
  add constraint project_role_assignments_protected_period_excl
  exclude using gist (
    project_id with =,
    role with =,
    tstzrange(effective_from, effective_to, '[)') with &&
  )
  where (role in (
    'PROJECT_SPONSOR',
    'PROJECT_OWNER',
    'PROJECT_MANAGER'
  ));


create or replace function
  public.enforce_role_assignment_within_membership()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_membership public.project_memberships%rowtype;
begin
  select membership.*
  into v_membership
  from public.project_memberships membership
  where membership.id = new.membership_id
    and membership.project_id = new.project_id;

  if not found then
    return new;
  end if;

  if new.effective_from < v_membership.effective_from
     or (
       v_membership.effective_to is not null
       and (
         new.effective_to is null
         or new.effective_to > v_membership.effective_to
       )
     ) then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_PERIOD_OUTSIDE_MEMBERSHIP';
  end if;

  return new;
end;
$$;

create trigger project_role_assignments_enforce_membership_period
before insert or update of
  project_id,
  membership_id,
  effective_from,
  effective_to
on public.project_role_assignments
for each row execute function
  public.enforce_role_assignment_within_membership();


create or replace function
  public.enforce_membership_period_contains_roles()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.project_role_assignments assignment
    where assignment.membership_id = new.id
      and assignment.project_id = new.project_id
      and (
        assignment.effective_from < new.effective_from
        or (
          new.effective_to is not null
          and (
            assignment.effective_to is null
            or assignment.effective_to > new.effective_to
          )
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_MEMBERSHIP_PERIOD_EXCLUDES_ROLE_HISTORY';
  end if;

  return new;
end;
$$;

create trigger project_memberships_contain_role_periods
before update of effective_from, effective_to
on public.project_memberships
for each row execute function
  public.enforce_membership_period_contains_roles();


create or replace function
  public.assert_project_membership_ordinary_role_coverage(
    p_membership_id uuid
  )
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_membership public.project_memberships%rowtype;
  v_actual_coverage tstzmultirange;
  v_required_coverage tstzmultirange;
begin
  select membership.*
  into v_membership
  from public.project_memberships membership
  where membership.id = p_membership_id;

  if not found then
    return;
  end if;

  /* Preserve unreconstructed, ended VS-001 role history truthfully. */
  if v_membership.user_id is not null
     and v_membership.membership_status = 'ENDED' then
    return;
  end if;

  select range_agg(
    tstzrange(
      assignment.effective_from,
      assignment.effective_to,
      '[)'
    )
  )
  into v_actual_coverage
  from public.project_role_assignments assignment
  where assignment.membership_id = v_membership.id
    and assignment.project_id = v_membership.project_id
    and assignment.role in (
      'PROJECT_MEMBER',
      'PROJECT_OBSERVER',
      'PROJECT_AUDITOR'
    );

  v_required_coverage := tstzmultirange(
    tstzrange(
      v_membership.effective_from,
      v_membership.effective_to,
      '[)'
    )
  );

  if v_actual_coverage is distinct from v_required_coverage then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_MEMBERSHIP_ORDINARY_ROLE_COVERAGE_INVALID';
  end if;
end;
$$;

create or replace function
  public.enforce_membership_ordinary_role_coverage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_project_membership_ordinary_role_coverage(new.id);
  return null;
end;
$$;

create constraint trigger project_memberships_require_ordinary_role
after insert or update on public.project_memberships
deferrable initially deferred
for each row execute function
  public.enforce_membership_ordinary_role_coverage();

create or replace function
  public.enforce_assignment_ordinary_role_coverage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT'
     and old.membership_id is distinct from new.membership_id then
    perform public.assert_project_membership_ordinary_role_coverage(
      old.membership_id
    );
  end if;

  perform public.assert_project_membership_ordinary_role_coverage(
    new.membership_id
  );

  return null;
end;
$$;

create constraint trigger project_role_assignments_require_ordinary_role
after insert or update on public.project_role_assignments
deferrable initially deferred
for each row execute function
  public.enforce_assignment_ordinary_role_coverage();


create or replace function
  public.enforce_canonical_membership_lifecycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.user_id is null
     and new.membership_status = 'ENDED'
     and new.termination_kind is null then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_MEMBERSHIP_CANONICAL_TERMINATION_REQUIRED';
  end if;

  return new;
end;
$$;

create trigger project_memberships_enforce_canonical_lifecycle
before insert or update of
  membership_status,
  termination_kind,
  user_id
on public.project_memberships
for each row execute function
  public.enforce_canonical_membership_lifecycle();


/* Protect canonical termination history rather than the inert legacy status. */
create or replace function public.prevent_membership_termination_rewrite()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.termination_kind is not null
     and row(
       new.membership_status,
       new.effective_to,
       new.termination_kind,
       new.terminated_by_person_id,
       new.termination_reason,
       new.termination_correlation_id,
       new.terminated_at
     ) is distinct from row(
       old.membership_status,
       old.effective_to,
       old.termination_kind,
       old.terminated_by_person_id,
       old.termination_reason,
       old.termination_correlation_id,
       old.terminated_at
     ) then
    raise exception using
      errcode = '55000',
      message = 'PROJECT_MEMBERSHIP_TERMINATION_HISTORY_IMMUTABLE';
  end if;

  return new;
end;
$$;


create unique index project_role_transfers_incoming_assignment_uidx
  on public.project_role_transfers(incoming_assignment_id);

create unique index project_role_transfers_outgoing_assignment_uidx
  on public.project_role_transfers(outgoing_assignment_id)
  where outgoing_assignment_id is not null;

create or replace function
  public.enforce_project_role_transfer_consistency()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_incoming public.project_role_assignments%rowtype;
  v_outgoing public.project_role_assignments%rowtype;
begin
  select assignment.*
  into v_incoming
  from public.project_role_assignments assignment
  where assignment.id = new.incoming_assignment_id;

  if found and (
    v_incoming.project_id is distinct from new.project_id
    or v_incoming.role is distinct from new.role
    or v_incoming.effective_from is distinct from new.effective_at
    or v_incoming.assigned_by_person_id is distinct from
       new.authorised_by_person_id
    or v_incoming.change_reason is distinct from new.reason
    or v_incoming.created_at is distinct from new.created_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_TRANSFER_INCOMING_INCONSISTENT';
  end if;

  if new.outgoing_assignment_id is not null then
    select assignment.*
    into v_outgoing
    from public.project_role_assignments assignment
    where assignment.id = new.outgoing_assignment_id;

    if found and (
      v_outgoing.project_id is distinct from new.project_id
      or v_outgoing.role is distinct from new.role
      or v_outgoing.effective_to is distinct from new.effective_at
    ) then
      raise exception using
        errcode = '23514',
        message = 'PROJECT_ROLE_TRANSFER_OUTGOING_INCONSISTENT';
    end if;
  end if;

  return new;
end;
$$;

create trigger project_role_transfers_enforce_consistency
before insert on public.project_role_transfers
for each row execute function
  public.enforce_project_role_transfer_consistency();

create or replace function
  public.assert_protected_assignment_transfer(
    p_assignment_id uuid
  )
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_assignment public.project_role_assignments%rowtype;
  v_transfer_count bigint;
begin
  select assignment.*
  into v_assignment
  from public.project_role_assignments assignment
  where assignment.id = p_assignment_id;

  if not found
     or v_assignment.role not in (
       'PROJECT_SPONSOR',
       'PROJECT_OWNER',
       'PROJECT_MANAGER'
     ) then
    return;
  end if;

  select count(*)
  into v_transfer_count
  from public.project_role_transfers transfer
  where transfer.incoming_assignment_id = v_assignment.id;

  if v_transfer_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_PROTECTED_TRANSFER_LEDGER_REQUIRED';
  end if;
end;
$$;

create or replace function
  public.enforce_protected_assignment_transfer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_protected_assignment_transfer(new.id);
  return null;
end;
$$;

create constraint trigger project_role_assignments_require_transfer
after insert or update on public.project_role_assignments
deferrable initially deferred
for each row execute function
  public.enforce_protected_assignment_transfer();


revoke all on function
  public.enforce_role_assignment_within_membership()
from public, anon, authenticated;

revoke all on function
  public.enforce_membership_period_contains_roles()
from public, anon, authenticated;

revoke all on function
  public.assert_project_membership_ordinary_role_coverage(uuid)
from public, anon, authenticated;

revoke all on function
  public.enforce_membership_ordinary_role_coverage()
from public, anon, authenticated;

revoke all on function
  public.enforce_assignment_ordinary_role_coverage()
from public, anon, authenticated;

revoke all on function
  public.enforce_canonical_membership_lifecycle()
from public, anon, authenticated;

revoke all on function
  public.enforce_project_role_transfer_consistency()
from public, anon, authenticated;

revoke all on function
  public.assert_protected_assignment_transfer(uuid)
from public, anon, authenticated;

revoke all on function
  public.enforce_protected_assignment_transfer()
from public, anon, authenticated;


/* All legacy membership columns remain present for R03D review. */
do $$
begin
  if exists (
    select required.attname
    from unnest(array[
      'user_id',
      'role_id',
      'joined_at',
      'status',
      'created_by'
    ]) required(attname)
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
      message = 'R03C_LEGACY_MEMBERSHIP_COLUMN_MISSING';
  end if;
end;
$$;
