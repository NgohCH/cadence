-- Cadence VS002-06C
-- Transactional Project Membership lifecycle persistence.
--
-- Authorization and Tasks responsibility assessment remain application
-- concerns. These functions preserve lifecycle history and enforce database
-- invariants only. No domain events are emitted in VS002-06C.


alter table public.project_memberships
  add column termination_kind text,
  add column terminated_by_person_id uuid
    references public.persons(id) on delete restrict,
  add column termination_correlation_id uuid,
  add column terminated_at timestamptz,
  add constraint project_memberships_termination_kind_check
    check (
      termination_kind is null
      or termination_kind in (
        'ADMINISTRATIVE_REMOVAL',
        'EXPIRY'
      )
    ),
  add constraint project_memberships_termination_provenance_check
    check (
      (
        termination_kind is null
        and terminated_by_person_id is null
        and termination_correlation_id is null
        and terminated_at is null
      )
      or (
        membership_status = 'ENDED'
        and termination_correlation_id is not null
        and terminated_at is not null
        and (
          (
            termination_kind = 'ADMINISTRATIVE_REMOVAL'
            and terminated_by_person_id is not null
          )
          or (
            termination_kind = 'EXPIRY'
            and terminated_by_person_id is null
          )
        )
      )
    );

create index project_memberships_due_expiry_idx
  on public.project_memberships(effective_to, id)
  where membership_status = 'ACTIVE'
    and effective_to is not null;

comment on column public.project_memberships.termination_kind is
  'ADMINISTRATIVE_REMOVAL or EXPIRY. NULL denotes pre-VS002-06 history without lifecycle provenance.';

comment on column public.project_memberships.terminated_by_person_id is
  'Stable Person who administratively ended membership; NULL only for system expiry or pre-VS002-06 history.';

comment on column public.project_memberships.termination_correlation_id is
  'Original request/process correlation retained for idempotent lifecycle history.';

comment on column public.project_memberships.terminated_at is
  'Timestamp at which the ENDED lifecycle state was materialised. Access may have ceased earlier at effective_to.';


create or replace function public.prevent_membership_termination_rewrite()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.termination_kind is not null
     and row(
       new.status,
       new.effective_to,
       new.termination_kind,
       new.terminated_by_person_id,
       new.termination_reason,
       new.termination_correlation_id,
       new.terminated_at
     ) is distinct from row(
       old.status,
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

create trigger project_memberships_prevent_termination_rewrite
before update on public.project_memberships
for each row execute function
  public.prevent_membership_termination_rewrite();


/*
 * A bounded Sponsor remains valid. Owner and Manager continuity cannot rely
 * on automatic membership expiry until a real continuity mechanism exists.
 * This trigger affects future writes only and does not rewrite existing rows.
 */
create or replace function public.enforce_protected_role_membership_continuity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_membership_effective_to timestamptz;
begin
  if new.role not in (
    'PROJECT_OWNER',
    'PROJECT_MANAGER'
  ) then
    return new;
  end if;

  select membership.effective_to
  into v_membership_effective_to
  from public.project_memberships as membership
  where membership.id = new.membership_id
    and membership.project_id = new.project_id;

  if not found then
    return new;
  end if;

  if v_membership_effective_to is not null then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_BOUNDED_MEMBERSHIP_REQUIRES_CONTINUITY';
  end if;

  return new;
end;
$$;

create trigger project_role_assignments_enforce_membership_continuity
before insert or update of role, membership_id, project_id
on public.project_role_assignments
for each row execute function
  public.enforce_protected_role_membership_continuity();


/* Returned history is read-only and is used by both lifecycle RPCs. */
create or replace function public.project_membership_role_history_at(
  p_membership_id uuid,
  p_closed_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', assignment.id,
        'project_id', assignment.project_id,
        'membership_id', assignment.membership_id,
        'role', assignment.role,
        'effective_from', assignment.effective_from,
        'effective_to', assignment.effective_to,
        'assigned_by_person_id', assignment.assigned_by_person_id,
        'change_reason', assignment.change_reason,
        'created_at', assignment.created_at
      )
      order by assignment.effective_from, assignment.id
    ),
    '[]'::jsonb
  )
  from public.project_role_assignments as assignment
  where assignment.membership_id = p_membership_id
    and assignment.effective_to = p_closed_at;
$$;


create or replace function public.terminate_project_membership(
  p_project_id uuid,
  p_membership_id uuid,
  p_effective_at timestamptz,
  p_terminated_by_person_id uuid,
  p_termination_reason text,
  p_correlation_id uuid
)
returns table (
  lifecycle_outcome text,
  result_membership_id uuid,
  result_person_id uuid,
  result_project_id uuid,
  result_effective_from timestamptz,
  result_effective_to timestamptz,
  result_membership_status text,
  result_granted_by_person_id uuid,
  result_created_at timestamptz,
  result_termination_kind text,
  result_terminated_by_person_id uuid,
  result_termination_reason text,
  result_termination_correlation_id uuid,
  result_terminated_at timestamptz,
  closed_assignments jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_membership public.project_memberships%rowtype;
begin
  if p_project_id is null
     or p_membership_id is null
     or p_effective_at is null
     or p_terminated_by_person_id is null
     or p_correlation_id is null then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_TERMINATION_REFERENCE_MISSING';
  end if;

  if p_termination_reason is not null
     and btrim(p_termination_reason) = '' then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_TERMINATION_REASON_INVALID';
  end if;

  /* Project-first locking matches protected-role transfer ordering. */
  select project.*
  into v_project
  from public.projects as project
  where project.id = p_project_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'PROJECT_NOT_FOUND';
  end if;

  select membership.*
  into v_membership
  from public.project_memberships as membership
  where membership.id = p_membership_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'PROJECT_MEMBERSHIP_NOT_FOUND';
  end if;

  if v_membership.project_id <> p_project_id then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_PROJECT_MISMATCH';
  end if;

  /* A retry with the original administrative correlation is read-only. */
  if v_membership.membership_status = 'ENDED'
     and v_membership.termination_kind = 'ADMINISTRATIVE_REMOVAL'
     and v_membership.termination_correlation_id = p_correlation_id then
    return query select
      'ALREADY_ENDED'::text,
      v_membership.id,
      v_membership.person_id,
      v_membership.project_id,
      v_membership.effective_from,
      v_membership.effective_to,
      v_membership.membership_status,
      v_membership.granted_by_person_id,
      v_membership.created_at,
      v_membership.termination_kind,
      v_membership.terminated_by_person_id,
      v_membership.termination_reason,
      v_membership.termination_correlation_id,
      v_membership.terminated_at,
      public.project_membership_role_history_at(
        v_membership.id,
        v_membership.effective_to
      );
    return;
  end if;

  if v_membership.membership_status = 'ENDED' then
    if v_membership.termination_kind = 'EXPIRY' then
      raise exception using
        errcode = '22023',
        message = 'PROJECT_MEMBERSHIP_EXPIRED';
    end if;

    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_NOT_EFFECTIVE';
  end if;

  if v_project.lifecycle_status in (
    'completed',
    'cancelled'
  ) then
    raise exception using
      errcode = '55000',
      message = 'MEMBER_REMOVAL_NOT_PERMITTED';
  end if;

  if p_effective_at <= v_membership.effective_from then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_NOT_EFFECTIVE';
  end if;

  if v_membership.effective_to is not null
     and p_effective_at >= v_membership.effective_to then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_EXPIRED';
  end if;

  if exists (
    select 1
    from public.project_role_assignments as assignment
    where assignment.project_id = p_project_id
      and assignment.membership_id = p_membership_id
      and assignment.role = 'PROJECT_OWNER'
      and assignment.effective_from <= p_effective_at
      and (
        assignment.effective_to is null
        or p_effective_at < assignment.effective_to
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'LAST_REQUIRED_ROLE_HOLDER';
  end if;

  if v_project.lifecycle_status in (
    'active',
    'on_hold'
  ) and exists (
    select 1
    from public.project_role_assignments as assignment
    where assignment.project_id = p_project_id
      and assignment.membership_id = p_membership_id
      and assignment.role = 'PROJECT_MANAGER'
      and assignment.effective_from <= p_effective_at
      and (
        assignment.effective_to is null
        or p_effective_at < assignment.effective_to
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'LAST_REQUIRED_ROLE_HOLDER';
  end if;

  update public.project_role_assignments as assignment
  set effective_to = p_effective_at
  where assignment.project_id = p_project_id
    and assignment.membership_id = p_membership_id
    and assignment.effective_from < p_effective_at
    and (
      assignment.effective_to is null
      or p_effective_at < assignment.effective_to
    );

  update public.project_memberships
  set
    status = 'inactive',
    effective_to = p_effective_at,
    termination_kind = 'ADMINISTRATIVE_REMOVAL',
    terminated_by_person_id = p_terminated_by_person_id,
    termination_reason = p_termination_reason,
    termination_correlation_id = p_correlation_id,
    terminated_at = p_effective_at
  where id = p_membership_id
  returning * into v_membership;

  return query select
    'ENDED'::text,
    v_membership.id,
    v_membership.person_id,
    v_membership.project_id,
    v_membership.effective_from,
    v_membership.effective_to,
    v_membership.membership_status,
    v_membership.granted_by_person_id,
    v_membership.created_at,
    v_membership.termination_kind,
    v_membership.terminated_by_person_id,
    v_membership.termination_reason,
    v_membership.termination_correlation_id,
    v_membership.terminated_at,
    public.project_membership_role_history_at(
      v_membership.id,
      v_membership.effective_to
    );
end;
$$;


create or replace function public.finalize_project_membership_expiry(
  p_project_id uuid,
  p_membership_id uuid,
  p_finalized_at timestamptz,
  p_termination_reason text,
  p_correlation_id uuid
)
returns table (
  lifecycle_outcome text,
  result_membership_id uuid,
  result_person_id uuid,
  result_project_id uuid,
  result_effective_from timestamptz,
  result_effective_to timestamptz,
  result_membership_status text,
  result_granted_by_person_id uuid,
  result_created_at timestamptz,
  result_termination_kind text,
  result_terminated_by_person_id uuid,
  result_termination_reason text,
  result_termination_correlation_id uuid,
  result_terminated_at timestamptz,
  closed_assignments jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_membership public.project_memberships%rowtype;
begin
  if p_project_id is null
     or p_membership_id is null
     or p_finalized_at is null
     or p_correlation_id is null then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_EXPIRY_REFERENCE_MISSING';
  end if;

  if p_termination_reason is not null
     and btrim(p_termination_reason) = '' then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_TERMINATION_REASON_INVALID';
  end if;

  select project.*
  into v_project
  from public.projects as project
  where project.id = p_project_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'PROJECT_NOT_FOUND';
  end if;

  select membership.*
  into v_membership
  from public.project_memberships as membership
  where membership.id = p_membership_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'PROJECT_MEMBERSHIP_NOT_FOUND';
  end if;

  if v_membership.project_id <> p_project_id then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_PROJECT_MISMATCH';
  end if;

  /* Any already-materialised VS002-06 transition retains original truth. */
  if v_membership.membership_status = 'ENDED'
     and v_membership.termination_kind is not null then
    return query select
      'ALREADY_ENDED'::text,
      v_membership.id,
      v_membership.person_id,
      v_membership.project_id,
      v_membership.effective_from,
      v_membership.effective_to,
      v_membership.membership_status,
      v_membership.granted_by_person_id,
      v_membership.created_at,
      v_membership.termination_kind,
      v_membership.terminated_by_person_id,
      v_membership.termination_reason,
      v_membership.termination_correlation_id,
      v_membership.terminated_at,
      public.project_membership_role_history_at(
        v_membership.id,
        v_membership.effective_to
      );
    return;
  end if;

  if v_membership.membership_status = 'ENDED' then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_ALREADY_ENDED_WITHOUT_PROVENANCE';
  end if;

  if v_membership.effective_to is null
     or p_finalized_at < v_membership.effective_to then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_NOT_EXPIRED';
  end if;

  /*
   * Preflight and future-write guards should keep this state unreachable.
   * If it nevertheless exists, expiry must surface the continuity conflict
   * for administrative resolution rather than silently orphaning Owner or
   * Manager responsibility.
   */
  if exists (
    select 1
    from public.project_role_assignments as assignment
    where assignment.project_id = p_project_id
      and assignment.membership_id = p_membership_id
      and assignment.role in (
        'PROJECT_OWNER',
        'PROJECT_MANAGER'
      )
      and assignment.effective_from < v_membership.effective_to
      and (
        assignment.effective_to is null
        or v_membership.effective_to < assignment.effective_to
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'LAST_REQUIRED_ROLE_HOLDER';
  end if;

  update public.project_role_assignments as assignment
  set effective_to = v_membership.effective_to
  where assignment.project_id = p_project_id
    and assignment.membership_id = p_membership_id
    and assignment.effective_from < v_membership.effective_to
    and (
      assignment.effective_to is null
      or v_membership.effective_to < assignment.effective_to
    );

  update public.project_memberships
  set
    status = 'inactive',
    termination_kind = 'EXPIRY',
    terminated_by_person_id = null,
    termination_reason = p_termination_reason,
    termination_correlation_id = p_correlation_id,
    terminated_at = p_finalized_at
  where id = p_membership_id
  returning * into v_membership;

  return query select
    'ENDED'::text,
    v_membership.id,
    v_membership.person_id,
    v_membership.project_id,
    v_membership.effective_from,
    v_membership.effective_to,
    v_membership.membership_status,
    v_membership.granted_by_person_id,
    v_membership.created_at,
    v_membership.termination_kind,
    v_membership.terminated_by_person_id,
    v_membership.termination_reason,
    v_membership.termination_correlation_id,
    v_membership.terminated_at,
    public.project_membership_role_history_at(
      v_membership.id,
      v_membership.effective_to
    );
end;
$$;


/* Read-only remote-preflight query; it never repairs historical data. */
create or replace function public.list_bounded_protected_role_violations(
  p_evaluated_at timestamptz
)
returns table (
  project_id uuid,
  membership_id uuid,
  assignment_id uuid,
  role text,
  membership_effective_to timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    membership.project_id,
    membership.id,
    assignment.id,
    assignment.role,
    membership.effective_to
  from public.project_memberships as membership
  join public.project_role_assignments as assignment
    on assignment.membership_id = membership.id
   and assignment.project_id = membership.project_id
  where p_evaluated_at is not null
    and membership.membership_status = 'ACTIVE'
    and membership.effective_to is not null
    and assignment.role in (
      'PROJECT_OWNER',
      'PROJECT_MANAGER'
    )
    and assignment.effective_from < membership.effective_to
    and (
      assignment.effective_to is null
      or membership.effective_to < assignment.effective_to
    )
  order by
    membership.project_id,
    assignment.role,
    assignment.id;
$$;


/* Service-role-only lifecycle persistence and preflight access. */
revoke all on function public.project_membership_role_history_at(
  uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.project_membership_role_history_at(
  uuid, timestamptz
) to service_role;

revoke all on function public.terminate_project_membership(
  uuid, uuid, timestamptz, uuid, text, uuid
) from public, anon, authenticated;
grant execute on function public.terminate_project_membership(
  uuid, uuid, timestamptz, uuid, text, uuid
) to service_role;

revoke all on function public.finalize_project_membership_expiry(
  uuid, uuid, timestamptz, text, uuid
) from public, anon, authenticated;
grant execute on function public.finalize_project_membership_expiry(
  uuid, uuid, timestamptz, text, uuid
) to service_role;

revoke all on function public.list_bounded_protected_role_violations(
  timestamptz
) from public, anon, authenticated;
grant execute on function public.list_bounded_protected_role_violations(
  timestamptz
) to service_role;
