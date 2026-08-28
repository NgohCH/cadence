-- Cadence v0.1
-- R02: VS-001 RBAC to VS-002 project-authorisation reconciliation.
--
-- Active legacy roles known to exist in QA are materialised into the frozen
-- VS-002 role model before the legacy RBAC fallback is removed.
--
-- This is historical state reconciliation, not a new business action.
-- VS002-07 explicitly does not backfill historical domain events, so this
-- migration calls the runtime-verified internal state-transition helpers
-- directly rather than the event-emitting public RPC wrappers.
--
-- Truthful mappings:
--   VIEWER       -> PROJECT_OBSERVER
--   PROJECT_LEAD -> PROJECT_AUDITOR + PROJECT_MANAGER
--
-- PROJECT_LEAD requires PROJECT_AUDITOR because the legacy role included
-- audit.view while PROJECT_MANAGER deliberately does not.
--
-- Legacy user_id and role_id are retained temporarily for consumers that have
-- not yet completed the R02 application cutover. They cease to be needed for
-- VS-002 authority once all consumers use ProjectAuthorisationService.


do $$
declare
  v_membership record;

  v_target_ordinary_role text;

  v_reconciled_at timestamptz :=
    clock_timestamp();

  v_ordinary_assignment_id uuid;

  v_manager_assignment_id uuid;
  v_manager_transfer_id uuid;
  v_manager_correlation_id uuid;

  v_existing_assignment
    public.project_role_assignments%rowtype;

begin

  /*
   * Fail instead of guessing if another active legacy project role exists.
   *
   * REVIEWER has no truthful frozen VS-002 equivalent. Other unsupported
   * legacy roles must therefore be reconciled explicitly rather than silently
   * inheriting a guessed permission model.
   */
  if exists (
    select 1
    from public.project_memberships pm
    join public.roles r
      on r.id = pm.role_id
    where pm.status = 'active'
      and pm.user_id is not null
      and pm.role_id is not null
      and r.code not in (
        'PROJECT_LEAD',
        'VIEWER'
      )
  ) then
    raise exception
      'R02_UNSUPPORTED_ACTIVE_LEGACY_PROJECT_ROLE'
      using errcode = '23514';
  end if;


  /*
   * Historical role materialisation must retain real provenance.
   * Never invent a system Person or substitute the affected member.
   */
  if exists (
    select 1
    from public.project_memberships pm
    join public.roles r
      on r.id = pm.role_id
    where pm.status = 'active'
      and pm.user_id is not null
      and pm.role_id is not null
      and r.code in (
        'PROJECT_LEAD',
        'VIEWER'
      )
      and pm.granted_by_person_id is null
  ) then
    raise exception
      'R02_LEGACY_ROLE_PROVENANCE_MISSING'
      using errcode = '23514';
  end if;


  for v_membership in
    select
      pm.id,
      pm.project_id,
      pm.person_id,
      pm.effective_from,
      pm.effective_to,
      pm.granted_by_person_id,
      r.code as legacy_role
    from public.project_memberships pm
    join public.roles r
      on r.id = pm.role_id
    where pm.status = 'active'
      and pm.user_id is not null
      and pm.role_id is not null
      and r.code in (
        'PROJECT_LEAD',
        'VIEWER'
      )
    order by
      pm.project_id,
      pm.id

  loop

    v_target_ordinary_role :=
      case v_membership.legacy_role
        when 'PROJECT_LEAD'
          then 'PROJECT_AUDITOR'
        when 'VIEWER'
          then 'PROJECT_OBSERVER'
        else null
      end;


    if v_target_ordinary_role is null then
      raise exception
        'R02_LEGACY_ROLE_MAPPING_MISSING membership=%',
        v_membership.id
        using errcode = '23514';
    end if;


    /*
     * Stable deterministic identifiers make the reconciliation inspectable
     * and protect against an accidental migration replay.
     */
    v_ordinary_assignment_id :=
      md5(
        'cadence:r02:ordinary:' ||
        v_membership.id::text ||
        ':' ||
        v_target_ordinary_role
      )::uuid;


    /*
     * These QA legacy memberships were verified to have no VS-002 ordinary
     * role history. If another assignment exists, stop rather than rewrite
     * history.
     *
     * The deterministic R02 assignment itself is allowed so a migration replay
     * can safely recognise already-reconciled state.
     */
    if exists (
      select 1
      from public.project_role_assignments pra
      where pra.membership_id =
          v_membership.id
        and pra.role in (
          'PROJECT_MEMBER',
          'PROJECT_OBSERVER',
          'PROJECT_AUDITOR'
        )
        and pra.id <>
          v_ordinary_assignment_id
    ) then
      raise exception
        'R02_ORDINARY_ROLE_HISTORY_COLLISION membership=%',
        v_membership.id
        using errcode = '23514';
    end if;


    select pra.*
    into v_existing_assignment
    from public.project_role_assignments pra
    where pra.id =
      v_ordinary_assignment_id;


    if found then

      if v_existing_assignment.project_id <>
            v_membership.project_id
         or v_existing_assignment.membership_id <>
            v_membership.id
         or v_existing_assignment.role <>
            v_target_ordinary_role
         or v_existing_assignment.effective_from <>
            v_membership.effective_from
         or v_existing_assignment.assigned_by_person_id <>
            v_membership.granted_by_person_id
      then
        raise exception
          'R02_ORDINARY_REPLAY_STATE_INVALID membership=%',
          v_membership.id
          using errcode = '23514';
      end if;

    else

      /*
       * Use the runtime-verified state helper, not the VS002-07 public wrapper.
       * The wrapper would emit a new domain event for historical authority.
       */
      perform *
      from public.vs002_07_change_ordinary_role_state(
        v_ordinary_assignment_id,
        v_membership.project_id,
        v_membership.id,
        v_target_ordinary_role,
        v_membership.effective_from,
        v_membership.granted_by_person_id,
        format(
          'R02 legacy RBAC reconciliation: %s -> %s',
          v_membership.legacy_role,
          v_target_ordinary_role
        ),
        v_reconciled_at
      );

    end if;


    /*
     * PROJECT_LEAD had audit.view plus broad operational control.
     *
     * PROJECT_AUDITOR supplies the former.
     * PROJECT_MANAGER supplies the latter.
     *
     * Manager is protected, so its first appointment must also be represented
     * by the immutable project_role_transfers ledger.
     */
    if v_membership.legacy_role =
       'PROJECT_LEAD'
    then

      v_manager_assignment_id :=
        md5(
          'cadence:r02:manager-assignment:' ||
          v_membership.id::text
        )::uuid;

      v_manager_transfer_id :=
        md5(
          'cadence:r02:manager-transfer:' ||
          v_membership.id::text
        )::uuid;

      v_manager_correlation_id :=
        md5(
          'cadence:r02:manager-correlation:' ||
          v_membership.id::text
        )::uuid;


      /*
       * QA was verified to contain no previous Manager history for either
       * affected project. Do not backdate through another Manager's history.
       */
      if exists (
        select 1
        from public.project_role_assignments pra
        where pra.project_id =
            v_membership.project_id
          and pra.role =
            'PROJECT_MANAGER'
          and pra.id <>
            v_manager_assignment_id
      ) then
        raise exception
          'R02_MANAGER_HISTORY_COLLISION project=%',
          v_membership.project_id
          using errcode = '23514';
      end if;


      select pra.*
      into v_existing_assignment
      from public.project_role_assignments pra
      where pra.id =
        v_manager_assignment_id;


      if found then

        if v_existing_assignment.project_id <>
              v_membership.project_id
           or v_existing_assignment.membership_id <>
              v_membership.id
           or v_existing_assignment.role <>
              'PROJECT_MANAGER'
           or v_existing_assignment.effective_from <>
              v_membership.effective_from
           or v_existing_assignment.assigned_by_person_id <>
              v_membership.granted_by_person_id
        then
          raise exception
            'R02_MANAGER_REPLAY_STATE_INVALID membership=%',
            v_membership.id
            using errcode = '23514';
        end if;


        if not exists (
          select 1
          from public.project_role_transfers prt
          where prt.id =
              v_manager_transfer_id
            and prt.project_id =
              v_membership.project_id
            and prt.role =
              'PROJECT_MANAGER'
            and prt.outgoing_assignment_id
              is null
            and prt.incoming_assignment_id =
              v_manager_assignment_id
            and prt.authorised_by_person_id =
              v_membership.granted_by_person_id
            and prt.correlation_id =
              v_manager_correlation_id
            and prt.effective_at =
              v_membership.effective_from
        ) then
          raise exception
            'R02_MANAGER_TRANSFER_LEDGER_MISSING membership=%',
            v_membership.id
            using errcode = '23514';
        end if;

      else

        perform *
        from public.vs002_07_transfer_protected_role_state(
          v_manager_transfer_id,
          v_manager_assignment_id,
          v_membership.project_id,
          v_membership.id,
          'PROJECT_MANAGER',
          v_membership.effective_from,
          v_membership.granted_by_person_id,
          'R02 legacy RBAC reconciliation: PROJECT_LEAD -> PROJECT_MANAGER',
          v_manager_correlation_id,
          v_reconciled_at
        );

      end if;

    end if;

  end loop;


  /*
   * Postcondition: every supported active legacy membership now has its
   * deterministic frozen ordinary role assignment.
   */
  if exists (
    select 1
    from public.project_memberships pm
    join public.roles r
      on r.id = pm.role_id
    where pm.status = 'active'
      and pm.user_id is not null
      and pm.role_id is not null
      and r.code in (
        'PROJECT_LEAD',
        'VIEWER'
      )
      and not exists (
        select 1
        from public.project_role_assignments pra
        where pra.membership_id = pm.id
          and pra.role =
            case r.code
              when 'PROJECT_LEAD'
                then 'PROJECT_AUDITOR'
              when 'VIEWER'
                then 'PROJECT_OBSERVER'
            end
          and pra.effective_from =
            pm.effective_from
      )
  ) then
    raise exception
      'R02_AUTHORISATION_RECONCILIATION_INCOMPLETE'
      using errcode = '23514';
  end if;

end;
$$;
