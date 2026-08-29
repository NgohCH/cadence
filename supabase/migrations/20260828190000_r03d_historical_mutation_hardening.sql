-- Cadence R03D
-- Historical mutation hardening and legacy-removal readiness.
--
-- R03D deliberately retains user_id, role_id, joined_at, status, and
-- created_by. They remain frozen historical compatibility/provenance fields.


/* DB-009: parent deletion must not implicitly erase membership history. */
alter table public.project_memberships
  drop constraint project_memberships_project_id_fkey,
  add constraint project_memberships_project_id_fkey
    foreign key (project_id)
    references public.projects(id)
    on delete restrict;


/* Exact historical User provenance must not be silently nulled. */
alter table public.project_memberships
  drop constraint project_memberships_created_by_fkey,
  add constraint project_memberships_created_by_fkey
    foreign key (created_by)
    references public.users(id)
    on delete restrict;


create or replace function
  public.enforce_membership_history_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if row(
       new.id,
       new.project_id,
       new.person_id,
       new.effective_from,
       new.granted_by_person_id,
       new.created_at
     ) is distinct from row(
       old.id,
       old.project_id,
       old.person_id,
       old.effective_from,
       old.granted_by_person_id,
       old.created_at
     ) then
    raise exception using
      errcode = '55000',
      message = 'PROJECT_MEMBERSHIP_IDENTITY_PROVENANCE_IMMUTABLE';
  end if;

  if old.membership_status = 'ENDED' then
    if row(
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
        message = 'PROJECT_MEMBERSHIP_HISTORY_IMMUTABLE';
    end if;

    return new;
  end if;

  if new.membership_status = 'ACTIVE' then
    if row(
         new.effective_to,
         new.termination_kind,
         new.terminated_by_person_id,
         new.termination_reason,
         new.termination_correlation_id,
         new.terminated_at
       ) is distinct from row(
         old.effective_to,
         old.termination_kind,
         old.terminated_by_person_id,
         old.termination_reason,
         old.termination_correlation_id,
         old.terminated_at
       ) then
      raise exception using
        errcode = '55000',
        message = 'PROJECT_MEMBERSHIP_FORWARD_LIFECYCLE_REQUIRED';
    end if;

    return new;
  end if;

  if new.membership_status <> 'ENDED'
     or new.effective_to is null
     or new.termination_kind is null
     or new.termination_correlation_id is null
     or new.terminated_at is null then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_MEMBERSHIP_FORWARD_LIFECYCLE_INVALID';
  end if;

  return new;
end;
$$;

create trigger project_memberships_enforce_history_immutability
before update on public.project_memberships
for each row execute function
  public.enforce_membership_history_immutability();


create or replace function
  public.enforce_role_assignment_history_immutability()
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
  where membership.id = old.membership_id
    and membership.project_id = old.project_id;

  if old.effective_to is not null then
    /* A bounded, still-active membership may replace its current assignment
     * before its inherited upper boundary. That is a forward close, not a
     * rewrite of closed history. */
    if v_membership.membership_status = 'ACTIVE'
       and old.effective_to is not distinct from v_membership.effective_to
       and row(
         new.id,
         new.project_id,
         new.membership_id,
         new.role,
         new.effective_from,
         new.assigned_by_person_id,
         new.change_reason,
         new.created_at
       ) is not distinct from row(
         old.id,
         old.project_id,
         old.membership_id,
         old.role,
         old.effective_from,
         old.assigned_by_person_id,
         old.change_reason,
         old.created_at
       )
       and new.effective_to is not null
       and new.effective_to < old.effective_to then
      return new;
    end if;

    if new is distinct from old then
      raise exception using
        errcode = '55000',
        message = 'PROJECT_ROLE_ASSIGNMENT_HISTORY_IMMUTABLE';
    end if;

    return new;
  end if;

  if row(
       new.id,
       new.project_id,
       new.membership_id,
       new.role,
       new.effective_from,
       new.assigned_by_person_id,
       new.change_reason,
       new.created_at
     ) is distinct from row(
       old.id,
       old.project_id,
       old.membership_id,
       old.role,
       old.effective_from,
       old.assigned_by_person_id,
       old.change_reason,
       old.created_at
     )
     or new.effective_to is null then
    raise exception using
      errcode = '55000',
      message = 'PROJECT_ROLE_ASSIGNMENT_FORWARD_CLOSE_REQUIRED';
  end if;

  return new;
end;
$$;

create trigger project_role_assignments_enforce_history_immutability
before update on public.project_role_assignments
for each row execute function
  public.enforce_role_assignment_history_immutability();


/* R03C inserted the ledger after its protected assignment; keep that
 * deferred sequencing while also rechecking all immutable ledger facts on
 * every assignment write. */
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
  v_transfer public.project_role_transfers%rowtype;
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

  select transfer.*
  into v_transfer
  from public.project_role_transfers transfer
  where transfer.incoming_assignment_id = v_assignment.id;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_PROTECTED_TRANSFER_LEDGER_REQUIRED';
  end if;

  if v_assignment.project_id is distinct from v_transfer.project_id
     or v_assignment.role is distinct from v_transfer.role
     or v_assignment.effective_from is distinct from v_transfer.effective_at
     or v_assignment.assigned_by_person_id is distinct from
        v_transfer.authorised_by_person_id
     or v_assignment.change_reason is distinct from v_transfer.reason
     or v_assignment.created_at is distinct from v_transfer.created_at then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_PROTECTED_TRANSFER_HISTORY_DIVERGED';
  end if;
end;
$$;


create or replace function public.prevent_historical_truncate()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'HISTORICAL_MEMBERSHIP_TRUNCATE_FORBIDDEN';
end;
$$;

create trigger project_memberships_prevent_truncate
before truncate on public.project_memberships
for each statement execute function public.prevent_historical_truncate();

create trigger project_role_assignments_prevent_truncate
before truncate on public.project_role_assignments
for each statement execute function public.prevent_historical_truncate();

create trigger project_role_transfers_prevent_truncate
before truncate on public.project_role_transfers
for each statement execute function public.prevent_historical_truncate();


/* SEC-002: current repositories insert through canonical contracts and
 * lifecycle/role changes run inside security-definer RPCs. They require no
 * direct service-role UPDATE, DELETE, or TRUNCATE on historical tables. */
revoke update, delete, truncate on table public.project_memberships
from service_role;

revoke update, delete, truncate on table public.project_role_assignments
from service_role;

revoke update, delete, truncate on table public.project_role_transfers
from service_role;


revoke all on function public.enforce_membership_history_immutability()
from public, anon, authenticated;

revoke all on function public.enforce_role_assignment_history_immutability()
from public, anon, authenticated;

revoke all on function public.prevent_historical_truncate()
from public, anon, authenticated;


/* R03D remains a retention checkpoint, not a legacy-column removal. */
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
      where actual.attrelid = 'public.project_memberships'::regclass
        and actual.attname = required.attname
        and not actual.attisdropped
    )
  ) then
    raise exception using
      errcode = '55000',
      message = 'R03D_LEGACY_MEMBERSHIP_COLUMN_MISSING';
  end if;
end;
$$;
