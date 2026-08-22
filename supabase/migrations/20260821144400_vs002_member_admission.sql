-- Cadence VS002-04
-- Atomic ordinary project-member admission.
--
-- Application-level authorisation remains owned by the published
-- ProjectAuthorisationService boundary introduced in VS002-03.
--
-- This persistence function is service-role only. It intentionally does not
-- call the legacy public.has_project_permission() helper because that helper
-- operates on the VS-001 user_id/role_id compatibility representation rather
-- than the VS-002 stable-Person/frozen-role authority model.
--
-- Responsibilities:
--   * serialize admission for the target stable Person;
--   * revalidate Person and grantor references;
--   * enforce half-open membership-period validity;
--   * reject overlapping ACTIVE memberships;
--   * create the Person-only membership;
--   * create the initial PROJECT_MEMBER role assignment;
--   * commit both records atomically.
--
-- Membership events remain deliberately deferred to VS002-07.

create or replace function public.add_project_member(
  p_membership_id uuid,
  p_project_id uuid,
  p_person_id uuid,
  p_effective_from timestamptz,
  p_effective_to timestamptz,
  p_granted_by_person_id uuid,
  p_membership_created_at timestamptz,
  p_role_assignment_id uuid,
  p_assigned_by_person_id uuid,
  p_role_created_at timestamptz
)
returns table (
  membership_id uuid,
  membership_person_id uuid,
  membership_project_id uuid,
  membership_effective_from timestamptz,
  membership_effective_to timestamptz,
  membership_status text,
  membership_granted_by_person_id uuid,
  membership_created_at timestamptz,
  membership_termination_reason text,

  role_assignment_id uuid,
  role_assignment_project_id uuid,
  role_assignment_membership_id uuid,
  role_assignment_role text,
  role_assignment_effective_from timestamptz,
  role_assignment_effective_to timestamptz,
  role_assignment_assigned_by_person_id uuid,
  role_assignment_change_reason text,
  role_assignment_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership
    public.project_memberships%rowtype;

  v_role_assignment
    public.project_role_assignments%rowtype;
begin
  /*
   * Required stable references.
   */
  if p_membership_id is null
     or p_project_id is null
     or p_person_id is null
     or p_effective_from is null
     or p_granted_by_person_id is null
     or p_membership_created_at is null
     or p_role_assignment_id is null
     or p_assigned_by_person_id is null
     or p_role_created_at is null then
    raise exception using
      errcode = '22023',
      message =
        'PROJECT_MEMBER_ADMISSION_REFERENCE_MISSING';
  end if;


  /*
   * Membership and its initial role are one admission decision.
   * VS002-04 does not permit a different role assigner.
   */
  if p_assigned_by_person_id <>
     p_granted_by_person_id then
    raise exception using
      errcode = '22023',
      message =
        'PROJECT_MEMBER_ADMISSION_ACTOR_MISMATCH';
  end if;


  /*
   * Half-open membership period:
   *
   *   [effective_from, effective_to)
   *
   * Null effective_to means open-ended.
   */
  if p_effective_to is not null
     and p_effective_to <= p_effective_from then
    raise exception using
      errcode = '22023',
      message =
        'PROJECT_MEMBERSHIP_PERIOD_INVALID';
  end if;


  /*
   * Lock the stable Person row.
   *
   * All concurrent admissions for this Person serialize here. This closes
   * the race where two requests could both observe "no overlap" and then
   * both insert memberships.
   */
  perform 1
  from public.persons as target_person
  where target_person.id =
    p_person_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message =
        'PROJECT_MEMBER_PERSON_NOT_FOUND';
  end if;


  if not exists (
    select 1
    from public.persons as grantor
    where grantor.id =
      p_granted_by_person_id
  ) then
    raise exception using
      errcode = '23503',
      message =
        'PROJECT_MEMBER_GRANTOR_NOT_FOUND';
  end if;


  /*
   * Duplicate protection.
   *
   * Historical ENDED memberships do not block re-entry.
   * ACTIVE memberships block only when their half-open periods overlap.
   *
   * Existing: [A, B)
   * Proposed: [C, D)
   *
   * They overlap exactly when:
   *
   *   A < D AND C < B
   *
   * Infinity represents an open-ended upper bound.
   */
  if exists (
    select 1
    from public.project_memberships
      as existing_membership
    where existing_membership.project_id =
        p_project_id

      and existing_membership.person_id =
        p_person_id

      and existing_membership.status =
        'active'

      and existing_membership.effective_from <
        coalesce(
          p_effective_to,
          'infinity'::timestamptz
        )

      and p_effective_from <
        coalesce(
          existing_membership.effective_to,
          'infinity'::timestamptz
        )
  ) then
    raise exception using
      errcode = '23505',
      message =
        'PROJECT_MEMBERSHIP_ALREADY_ACTIVE';
  end if;


  /*
   * Create the VS-002 Person-only membership.
   *
   * user_id and role_id intentionally remain null. They belong only to the
   * VS-001 compatibility representation.
   */
  insert into public.project_memberships (
    id,
    project_id,
    user_id,
    role_id,
    status,
    joined_at,
    person_id,
    effective_to,
    granted_by_person_id,
    created_at,
    termination_reason
  )
  values (
    p_membership_id,
    p_project_id,
    null,
    null,
    'active',
    p_effective_from,
    p_person_id,
    p_effective_to,
    p_granted_by_person_id,
    p_membership_created_at,
    null
  )
  returning
    project_memberships.*
  into
    v_membership;


  /*
   * VS002-04 admits an ordinary PROJECT_MEMBER.
   *
   * General role assignment/change and protected-role transfer remain
   * VS002-05 responsibilities.
   */
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
    p_role_assignment_id,
    p_project_id,
    p_membership_id,
    'PROJECT_MEMBER',
    p_effective_from,
    p_effective_to,
    p_assigned_by_person_id,
    null,
    p_role_created_at
  )
  returning
    project_role_assignments.*
  into
    v_role_assignment;


  return query
  select
    v_membership.id,
    v_membership.person_id,
    v_membership.project_id,
    v_membership.effective_from,
    v_membership.effective_to,
    v_membership.membership_status,
    v_membership.granted_by_person_id,
    v_membership.created_at,
    v_membership.termination_reason,

    v_role_assignment.id,
    v_role_assignment.project_id,
    v_role_assignment.membership_id,
    v_role_assignment.role,
    v_role_assignment.effective_from,
    v_role_assignment.effective_to,
    v_role_assignment.assigned_by_person_id,
    v_role_assignment.change_reason,
    v_role_assignment.created_at;
end;
$$;


/*
 * API service only.
 *
 * Browser clients must not bypass ProjectMembershipService.
 */
revoke all on function public.add_project_member(
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  uuid,
  timestamptz,
  uuid,
  uuid,
  timestamptz
) from public;

revoke all on function public.add_project_member(
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  uuid,
  timestamptz,
  uuid,
  uuid,
  timestamptz
) from anon;

revoke all on function public.add_project_member(
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  uuid,
  timestamptz,
  uuid,
  uuid,
  timestamptz
) from authenticated;

grant execute on function public.add_project_member(
  uuid,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  uuid,
  timestamptz,
  uuid,
  uuid,
  timestamptz
) to service_role;
