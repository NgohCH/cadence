-- Cadence VS002-05B
-- Transactional project-role management persistence.
--
-- Authorization is deliberately absent. ProjectAuthorisationService decides
-- whether an operation is allowed before the backend invokes these RPCs. The
-- stable Person parameters below are retained only as provenance.


/*
 * Narrow VS-001 permission compatibility.
 *
 * Only legacy roles already trusted with member.assign_owner receive the two
 * missing protected-assignment permissions. No frozen-role mapping or new
 * legacy role-name interpretation is introduced.
 */
insert into public.permissions (
  code,
  description
)
values
  (
    'member.assign_manager',
    'Assign or transfer the Project Manager role.'
  ),
  (
    'member.assign_sponsor',
    'Assign or transfer the Project Sponsor role.'
  )
on conflict (code) do nothing;

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  owner_permission_holder.role_id,
  missing_permission.id
from public.role_permissions
  as owner_permission_holder
join public.permissions
  as owner_permission
  on owner_permission.id =
    owner_permission_holder.permission_id
cross join public.permissions
  as missing_permission
where owner_permission.code =
    'member.assign_owner'
  and missing_permission.code in (
    'member.assign_manager',
    'member.assign_sponsor'
  )
on conflict do nothing;


/*
 * Composite assignment identity lets the transfer ledger enforce that both
 * referenced assignments belong to the same project and protected role as
 * the ledger row.
 */
alter table public.project_role_assignments
  add constraint project_role_assignments_id_project_role_key
  unique (id, project_id, role);

create table public.project_role_transfers (
  id uuid primary key,
  project_id uuid not null
    references public.projects(id)
    on delete restrict,
  role text not null
    check (role in (
      'PROJECT_SPONSOR',
      'PROJECT_OWNER',
      'PROJECT_MANAGER'
    )),
  outgoing_assignment_id uuid,
  incoming_assignment_id uuid not null,
  authorised_by_person_id uuid not null
    references public.persons(id)
    on delete restrict,
  reason text not null,
  correlation_id uuid not null,
  effective_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint project_role_transfers_reason_not_blank
    check (btrim(reason) <> ''),
  constraint project_role_transfers_distinct_assignments
    check (
      outgoing_assignment_id is null
      or outgoing_assignment_id <>
        incoming_assignment_id
    ),
  constraint project_role_transfers_outgoing_assignment_fkey
    foreign key (
      outgoing_assignment_id,
      project_id,
      role
    )
    references public.project_role_assignments(
      id,
      project_id,
      role
    )
    on delete restrict,
  constraint project_role_transfers_incoming_assignment_fkey
    foreign key (
      incoming_assignment_id,
      project_id,
      role
    )
    references public.project_role_assignments(
      id,
      project_id,
      role
    )
    on delete restrict
);

create index project_role_transfers_project_role_effective_idx
  on public.project_role_transfers(
    project_id,
    role,
    effective_at
  );

create or replace function public.prevent_project_role_transfer_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'project role transfer history is immutable'
    using errcode = '55000';
end;
$$;

create trigger project_role_transfers_prevent_update
before update on public.project_role_transfers
for each row execute function
  public.prevent_project_role_transfer_update();

create trigger project_role_transfers_prevent_hard_delete
before delete on public.project_role_transfers
for each row execute function
  public.prevent_hard_delete();

alter table public.project_role_transfers
  enable row level security;

revoke all on table public.project_role_transfers
  from anon, authenticated;

grant select on table
  public.project_role_transfers
to service_role;


create or replace function public.change_project_ordinary_role(
  p_assignment_id uuid,
  p_project_id uuid,
  p_membership_id uuid,
  p_role text,
  p_effective_at timestamptz,
  p_assigned_by_person_id uuid,
  p_change_reason text,
  p_created_at timestamptz
)
returns table (
  closed_assignment_id uuid,
  closed_assignment_project_id uuid,
  closed_assignment_membership_id uuid,
  closed_assignment_role text,
  closed_assignment_effective_from timestamptz,
  closed_assignment_effective_to timestamptz,
  closed_assignment_assigned_by_person_id uuid,
  closed_assignment_change_reason text,
  closed_assignment_created_at timestamptz,
  new_assignment_id uuid,
  new_assignment_project_id uuid,
  new_assignment_membership_id uuid,
  new_assignment_role text,
  new_assignment_effective_from timestamptz,
  new_assignment_effective_to timestamptz,
  new_assignment_assigned_by_person_id uuid,
  new_assignment_change_reason text,
  new_assignment_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership
    public.project_memberships%rowtype;
  v_closed
    public.project_role_assignments%rowtype;
  v_new
    public.project_role_assignments%rowtype;
  v_effective_count bigint;
begin
  if p_assignment_id is null
     or p_project_id is null
     or p_membership_id is null
     or p_role is null
     or p_effective_at is null
     or p_assigned_by_person_id is null
     or p_created_at is null then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_ROLE_REFERENCE_MISSING';
  end if;

  if p_change_reason is not null
     and btrim(p_change_reason) = '' then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_ROLE_REASON_INVALID';
  end if;

  if p_role in (
    'PROJECT_SPONSOR',
    'PROJECT_OWNER',
    'PROJECT_MANAGER'
  ) then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_ROLE_TRANSFER_REQUIRED';
  end if;

  if p_role not in (
    'PROJECT_MEMBER',
    'PROJECT_OBSERVER',
    'PROJECT_AUDITOR'
  ) then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_ROLE_ORDINARY_REQUIRED';
  end if;

  /* All ordinary changes for this membership serialize on this row. */
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

  if v_membership.membership_status <> 'ACTIVE'
     or p_effective_at < v_membership.effective_from
     or (
       v_membership.effective_to is not null
       and p_effective_at >= v_membership.effective_to
     ) then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_NOT_EFFECTIVE';
  end if;

  select count(*)
  into v_effective_count
  from public.project_role_assignments as assignment
  where assignment.project_id = p_project_id
    and assignment.membership_id = p_membership_id
    and assignment.role in (
      'PROJECT_MEMBER',
      'PROJECT_OBSERVER',
      'PROJECT_AUDITOR'
    )
    and assignment.effective_from <= p_effective_at
    and (
      assignment.effective_to is null
      or p_effective_at < assignment.effective_to
    );

  if v_effective_count > 1 then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_ORDINARY_CARDINALITY_INVALID';
  end if;

  if v_effective_count = 1 then
    select assignment.*
    into v_closed
    from public.project_role_assignments as assignment
    where assignment.project_id = p_project_id
      and assignment.membership_id = p_membership_id
      and assignment.role in (
        'PROJECT_MEMBER',
        'PROJECT_OBSERVER',
        'PROJECT_AUDITOR'
      )
      and assignment.effective_from <= p_effective_at
      and (
        assignment.effective_to is null
        or p_effective_at < assignment.effective_to
      )
    for update;

    if v_closed.role = p_role then
      raise exception using
        errcode = '22023',
        message = 'PROJECT_ROLE_ORDINARY_UNCHANGED';
    end if;

    if v_closed.effective_from >= p_effective_at then
      raise exception using
        errcode = '22023',
        message = 'PROJECT_ROLE_TRANSITION_TIME_INVALID';
    end if;

    update public.project_role_assignments
    set effective_to = p_effective_at
    where id = v_closed.id
    returning * into v_closed;
  end if;

  /* Zero previous assignment is a truthful VS-001 compatibility case. */
  insert into public.project_role_assignments (
    id,
    project_id,
    membership_id,
    role,
    effective_from,
    effective_to,
    assigned_by_person_id,
    change_reason,
    created_at
  )
  values (
    p_assignment_id,
    p_project_id,
    p_membership_id,
    p_role,
    p_effective_at,
    v_membership.effective_to,
    p_assigned_by_person_id,
    p_change_reason,
    p_created_at
  )
  returning * into v_new;

  return query select
    v_closed.id,
    v_closed.project_id,
    v_closed.membership_id,
    v_closed.role,
    v_closed.effective_from,
    v_closed.effective_to,
    v_closed.assigned_by_person_id,
    v_closed.change_reason,
    v_closed.created_at,
    v_new.id,
    v_new.project_id,
    v_new.membership_id,
    v_new.role,
    v_new.effective_from,
    v_new.effective_to,
    v_new.assigned_by_person_id,
    v_new.change_reason,
    v_new.created_at;
end;
$$;


create or replace function public.transfer_project_protected_role(
  p_transfer_id uuid,
  p_incoming_assignment_id uuid,
  p_project_id uuid,
  p_incoming_membership_id uuid,
  p_role text,
  p_effective_at timestamptz,
  p_authorised_by_person_id uuid,
  p_reason text,
  p_correlation_id uuid,
  p_created_at timestamptz
)
returns table (
  closed_assignment_id uuid,
  closed_assignment_project_id uuid,
  closed_assignment_membership_id uuid,
  closed_assignment_role text,
  closed_assignment_effective_from timestamptz,
  closed_assignment_effective_to timestamptz,
  closed_assignment_assigned_by_person_id uuid,
  closed_assignment_change_reason text,
  closed_assignment_created_at timestamptz,
  new_assignment_id uuid,
  new_assignment_project_id uuid,
  new_assignment_membership_id uuid,
  new_assignment_role text,
  new_assignment_effective_from timestamptz,
  new_assignment_effective_to timestamptz,
  new_assignment_assigned_by_person_id uuid,
  new_assignment_change_reason text,
  new_assignment_created_at timestamptz,
  transfer_id uuid,
  transfer_project_id uuid,
  transfer_role text,
  transfer_outgoing_assignment_id uuid,
  transfer_incoming_assignment_id uuid,
  transfer_authorised_by_person_id uuid,
  transfer_reason text,
  transfer_correlation_id uuid,
  transfer_effective_at timestamptz,
  transfer_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership
    public.project_memberships%rowtype;
  v_outgoing
    public.project_role_assignments%rowtype;
  v_incoming
    public.project_role_assignments%rowtype;
  v_transfer
    public.project_role_transfers%rowtype;
  v_effective_count bigint;
begin
  if p_transfer_id is null
     or p_incoming_assignment_id is null
     or p_project_id is null
     or p_incoming_membership_id is null
     or p_role is null
     or p_effective_at is null
     or p_authorised_by_person_id is null
     or p_reason is null
     or p_correlation_id is null
     or p_created_at is null then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_ROLE_REFERENCE_MISSING';
  end if;

  if btrim(p_reason) = '' then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_ROLE_REASON_INVALID';
  end if;

  if p_role not in (
    'PROJECT_SPONSOR',
    'PROJECT_OWNER',
    'PROJECT_MANAGER'
  ) then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_ROLE_PROTECTED_REQUIRED';
  end if;

  /* All protected appointments/transfers for a project serialize here. */
  perform 1
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
  where membership.id = p_incoming_membership_id
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

  if v_membership.membership_status <> 'ACTIVE'
     or p_effective_at < v_membership.effective_from
     or (
       v_membership.effective_to is not null
       and p_effective_at >= v_membership.effective_to
     ) then
    raise exception using
      errcode = '22023',
      message = 'PROJECT_MEMBERSHIP_NOT_EFFECTIVE';
  end if;

  select count(*)
  into v_effective_count
  from public.project_role_assignments as assignment
  where assignment.project_id = p_project_id
    and assignment.role = p_role
    and assignment.effective_from <= p_effective_at
    and (
      assignment.effective_to is null
      or p_effective_at < assignment.effective_to
    );

  if v_effective_count > 1 then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_PROTECTED_CARDINALITY_INVALID';
  end if;

  if v_effective_count = 1 then
    select assignment.*
    into v_outgoing
    from public.project_role_assignments as assignment
    where assignment.project_id = p_project_id
      and assignment.role = p_role
      and assignment.effective_from <= p_effective_at
      and (
        assignment.effective_to is null
        or p_effective_at < assignment.effective_to
      )
    for update;

    if v_outgoing.membership_id =
       p_incoming_membership_id then
      raise exception using
        errcode = '22023',
        message = 'PROJECT_ROLE_PROTECTED_HOLDER_UNCHANGED';
    end if;

    if v_outgoing.effective_from >= p_effective_at then
      raise exception using
        errcode = '22023',
        message = 'PROJECT_ROLE_TRANSITION_TIME_INVALID';
    end if;

    update public.project_role_assignments
    set effective_to = p_effective_at
    where id = v_outgoing.id
    returning * into v_outgoing;
  end if;

  insert into public.project_role_assignments (
    id,
    project_id,
    membership_id,
    role,
    effective_from,
    effective_to,
    assigned_by_person_id,
    change_reason,
    created_at
  )
  values (
    p_incoming_assignment_id,
    p_project_id,
    p_incoming_membership_id,
    p_role,
    p_effective_at,
    v_membership.effective_to,
    p_authorised_by_person_id,
    p_reason,
    p_created_at
  )
  returning * into v_incoming;

  insert into public.project_role_transfers (
    id,
    project_id,
    role,
    outgoing_assignment_id,
    incoming_assignment_id,
    authorised_by_person_id,
    reason,
    correlation_id,
    effective_at,
    created_at
  )
  values (
    p_transfer_id,
    p_project_id,
    p_role,
    v_outgoing.id,
    v_incoming.id,
    p_authorised_by_person_id,
    p_reason,
    p_correlation_id,
    p_effective_at,
    p_created_at
  )
  returning * into v_transfer;

  return query select
    v_outgoing.id,
    v_outgoing.project_id,
    v_outgoing.membership_id,
    v_outgoing.role,
    v_outgoing.effective_from,
    v_outgoing.effective_to,
    v_outgoing.assigned_by_person_id,
    v_outgoing.change_reason,
    v_outgoing.created_at,
    v_incoming.id,
    v_incoming.project_id,
    v_incoming.membership_id,
    v_incoming.role,
    v_incoming.effective_from,
    v_incoming.effective_to,
    v_incoming.assigned_by_person_id,
    v_incoming.change_reason,
    v_incoming.created_at,
    v_transfer.id,
    v_transfer.project_id,
    v_transfer.role,
    v_transfer.outgoing_assignment_id,
    v_transfer.incoming_assignment_id,
    v_transfer.authorised_by_person_id,
    v_transfer.reason,
    v_transfer.correlation_id,
    v_transfer.effective_at,
    v_transfer.created_at;
end;
$$;


/* Backend service only; browser roles cannot bypass application authorization. */
revoke all on function public.change_project_ordinary_role(
  uuid, uuid, uuid, text, timestamptz, uuid, text, timestamptz
) from public;
revoke all on function public.change_project_ordinary_role(
  uuid, uuid, uuid, text, timestamptz, uuid, text, timestamptz
) from anon;
revoke all on function public.change_project_ordinary_role(
  uuid, uuid, uuid, text, timestamptz, uuid, text, timestamptz
) from authenticated;
grant execute on function public.change_project_ordinary_role(
  uuid, uuid, uuid, text, timestamptz, uuid, text, timestamptz
) to service_role;

revoke all on function public.transfer_project_protected_role(
  uuid, uuid, uuid, uuid, text, timestamptz, uuid, text, uuid, timestamptz
) from public;
revoke all on function public.transfer_project_protected_role(
  uuid, uuid, uuid, uuid, text, timestamptz, uuid, text, uuid, timestamptz
) from anon;
revoke all on function public.transfer_project_protected_role(
  uuid, uuid, uuid, uuid, text, timestamptz, uuid, text, uuid, timestamptz
) from authenticated;
grant execute on function public.transfer_project_protected_role(
  uuid, uuid, uuid, uuid, text, timestamptz, uuid, text, uuid, timestamptz
) to service_role;


comment on table public.project_role_transfers is
  'Immutable protected-role appointment and transfer ledger. Authorization is decided by ProjectAuthorisationService before persistence.';

comment on column public.project_role_transfers.outgoing_assignment_id is
  'NULL only when the protected role had no effective holder and this record is its first appointment.';
