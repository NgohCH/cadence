\set ON_ERROR_STOP on

begin;


insert into public.persons (id, display_name)
values
  ('c0300000-0000-4000-8000-000000000001', 'R03C Actor'),
  ('c0300000-0000-4000-8000-000000000002', 'R03C Member One'),
  ('c0300000-0000-4000-8000-000000000003', 'R03C Member Two'),
  ('c0300000-0000-4000-8000-000000000004', 'R03C Zero Role Probe'),
  ('c0300000-0000-4000-8000-000000000005', 'R03C Gap Probe');

insert into public.users (
  id,
  username,
  display_name,
  email,
  person_id
)
values (
  'c0300000-0000-4000-8000-000000000001',
  'r03c_actor',
  'R03C Actor',
  'r03c_actor@example.test',
  'c0300000-0000-4000-8000-000000000001'
);

insert into public.projects (id, name, owner_user_id)
values (
  'c0300000-0000-4000-8000-000000000010',
  'R03C Runtime Project',
  'c0300000-0000-4000-8000-000000000001'
);


select * from public.add_project_member(
  'c0300000-0000-4000-8000-000000000020',
  'c0300000-0000-4000-8000-000000000010',
  'c0300000-0000-4000-8000-000000000002',
  '2026-01-01T00:00:00Z',
  null,
  'c0300000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z',
  'c0300000-0000-4000-8000-000000000030',
  'c0300000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z',
  'c0300000-0000-4000-8000-000000000040'
);

select * from public.add_project_member(
  'c0300000-0000-4000-8000-000000000021',
  'c0300000-0000-4000-8000-000000000010',
  'c0300000-0000-4000-8000-000000000003',
  '2026-01-01T00:00:00Z',
  null,
  'c0300000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z',
  'c0300000-0000-4000-8000-000000000031',
  'c0300000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z',
  'c0300000-0000-4000-8000-000000000041'
);


select * from public.transfer_project_protected_role(
  'c0300000-0000-4000-8000-000000000050',
  'c0300000-0000-4000-8000-000000000051',
  'c0300000-0000-4000-8000-000000000010',
  'c0300000-0000-4000-8000-000000000020',
  'PROJECT_OWNER',
  '2026-02-01T00:00:00Z',
  'c0300000-0000-4000-8000-000000000001',
  'Initial owner',
  'c0300000-0000-4000-8000-000000000052',
  '2026-02-01T00:00:00Z'
);

select * from public.transfer_project_protected_role(
  'c0300000-0000-4000-8000-000000000053',
  'c0300000-0000-4000-8000-000000000054',
  'c0300000-0000-4000-8000-000000000010',
  'c0300000-0000-4000-8000-000000000021',
  'PROJECT_OWNER',
  '2026-03-01T00:00:00Z',
  'c0300000-0000-4000-8000-000000000001',
  'Owner transfer',
  'c0300000-0000-4000-8000-000000000055',
  '2026-03-01T00:00:00Z'
);


do $$
begin
  begin
    insert into public.project_memberships (
      id, project_id, person_id, effective_from, effective_to,
      membership_status, granted_by_person_id, created_at
    ) values (
      'c0300000-0000-4000-8000-000000000060',
      'c0300000-0000-4000-8000-000000000010',
      'c0300000-0000-4000-8000-000000000002',
      '2026-06-01T00:00:00Z', null, 'ACTIVE',
      'c0300000-0000-4000-8000-000000000001',
      '2026-06-01T00:00:00Z'
    );
    raise exception 'Expected membership overlap rejection';
  exception when exclusion_violation then null;
  end;

  begin
    insert into public.project_memberships (
      id, project_id, person_id, effective_from, effective_to,
      membership_status, granted_by_person_id, created_at
    ) values (
      'c0300000-0000-4000-8000-000000000061',
      'c0300000-0000-4000-8000-000000000010',
      'c0300000-0000-4000-8000-000000000004',
      '2026-01-01T00:00:00Z', null, 'ACTIVE',
      'c0300000-0000-4000-8000-000000000001',
      '2026-01-01T00:00:00Z'
    );
    set constraints project_memberships_require_ordinary_role immediate;
    raise exception 'Expected zero ordinary-role rejection';
  exception when check_violation then
    if sqlerrm <> 'PROJECT_MEMBERSHIP_ORDINARY_ROLE_COVERAGE_INVALID' then
      raise;
    end if;
  end;

  begin
    insert into public.project_role_assignments (
      id, project_id, membership_id, role, effective_from,
      effective_to, assigned_by_person_id, created_at
    ) values (
      'c0300000-0000-4000-8000-000000000062',
      'c0300000-0000-4000-8000-000000000010',
      'c0300000-0000-4000-8000-000000000020',
      'PROJECT_OBSERVER', '2026-04-01T00:00:00Z', null,
      'c0300000-0000-4000-8000-000000000001',
      '2026-04-01T00:00:00Z'
    );
    raise exception 'Expected multiple ordinary-role rejection';
  exception when exclusion_violation then null;
  end;

  begin
    insert into public.project_role_assignments (
      id, project_id, membership_id, role, effective_from,
      effective_to, assigned_by_person_id, created_at
    ) values (
      'c0300000-0000-4000-8000-000000000063',
      'c0300000-0000-4000-8000-000000000010',
      'c0300000-0000-4000-8000-000000000020',
      'PROJECT_AUDITOR', '2025-01-01T00:00:00Z',
      '2025-02-01T00:00:00Z',
      'c0300000-0000-4000-8000-000000000001',
      '2025-01-01T00:00:00Z'
    );
    raise exception 'Expected role containment rejection';
  exception when check_violation then
    if sqlerrm <> 'PROJECT_ROLE_PERIOD_OUTSIDE_MEMBERSHIP' then raise; end if;
  end;

  begin
    insert into public.project_role_assignments (
      id, project_id, membership_id, role, effective_from,
      effective_to, assigned_by_person_id, created_at
    ) values (
      'c0300000-0000-4000-8000-000000000064',
      'c0300000-0000-4000-8000-000000000010',
      'c0300000-0000-4000-8000-000000000020',
      'PROJECT_OWNER', '2026-04-01T00:00:00Z', null,
      'c0300000-0000-4000-8000-000000000001',
      '2026-04-01T00:00:00Z'
    );
    raise exception 'Expected protected singleton rejection';
  exception when exclusion_violation then null;
  end;

  begin
    insert into public.project_role_assignments (
      id, project_id, membership_id, role, effective_from,
      effective_to, assigned_by_person_id, change_reason, created_at
    ) values (
      'c0300000-0000-4000-8000-000000000065',
      'c0300000-0000-4000-8000-000000000010',
      'c0300000-0000-4000-8000-000000000020',
      'PROJECT_SPONSOR', '2026-04-01T00:00:00Z', null,
      'c0300000-0000-4000-8000-000000000001',
      'Inconsistent transfer', '2026-04-01T00:00:00Z'
    );
    insert into public.project_role_transfers (
      id, project_id, role, outgoing_assignment_id,
      incoming_assignment_id, authorised_by_person_id, reason,
      correlation_id, effective_at, created_at
    ) values (
      'c0300000-0000-4000-8000-000000000066',
      'c0300000-0000-4000-8000-000000000010',
      'PROJECT_SPONSOR', null,
      'c0300000-0000-4000-8000-000000000065',
      'c0300000-0000-4000-8000-000000000001',
      'Inconsistent transfer',
      'c0300000-0000-4000-8000-000000000067',
      '2026-05-01T00:00:00Z', '2026-04-01T00:00:00Z'
    );
    raise exception 'Expected transfer consistency rejection';
  exception when check_violation then
    if sqlerrm <> 'PROJECT_ROLE_TRANSFER_INCOMING_INCONSISTENT' then raise; end if;
  end;

  begin
    insert into public.project_role_assignments (
      id, project_id, membership_id, role, effective_from,
      effective_to, assigned_by_person_id, change_reason, created_at
    ) values (
      'c0300000-0000-4000-8000-000000000068',
      'c0300000-0000-4000-8000-000000000010',
      'c0300000-0000-4000-8000-000000000020',
      'PROJECT_SPONSOR', '2026-04-01T00:00:00Z', null,
      'c0300000-0000-4000-8000-000000000001',
      'Missing ledger', '2026-04-01T00:00:00Z'
    );
    set constraints project_role_assignments_require_transfer immediate;
    raise exception 'Expected protected ledger rejection';
  exception when check_violation then
    if sqlerrm <> 'PROJECT_ROLE_PROTECTED_TRANSFER_LEDGER_REQUIRED' then raise; end if;
  end;

  begin
    update public.project_memberships
    set effective_to = '2026-06-01T00:00:00Z'
    where id = 'c0300000-0000-4000-8000-000000000020';
    raise exception 'Expected reverse role containment rejection';
  exception when check_violation then
    if sqlerrm <> 'PROJECT_MEMBERSHIP_PERIOD_EXCLUDES_ROLE_HISTORY' then raise; end if;
  when sqlstate '55000' then
    if sqlerrm <> 'PROJECT_MEMBERSHIP_FORWARD_LIFECYCLE_REQUIRED' then raise; end if;
  end;

  begin
    update public.project_memberships
    set membership_status = 'ENDED',
        effective_to = '2026-06-01T00:00:00Z'
    where id = 'c0300000-0000-4000-8000-000000000020';
    raise exception 'Expected canonical termination provenance rejection';
  exception when check_violation then
    if sqlerrm not in (
      'PROJECT_MEMBERSHIP_PERIOD_EXCLUDES_ROLE_HISTORY',
      'PROJECT_MEMBERSHIP_CANONICAL_TERMINATION_REQUIRED',
      'PROJECT_MEMBERSHIP_FORWARD_LIFECYCLE_REQUIRED'
    ) then raise; end if;
  end;

  begin
    insert into public.project_memberships (
      id, project_id, person_id, effective_from, effective_to,
      membership_status, granted_by_person_id, created_at
    ) values (
      'c0300000-0000-4000-8000-000000000069',
      'c0300000-0000-4000-8000-000000000010',
      'c0300000-0000-4000-8000-000000000005',
      '2026-01-01T00:00:00Z', null, 'ACTIVE',
      'c0300000-0000-4000-8000-000000000001',
      '2026-01-01T00:00:00Z'
    );
    insert into public.project_role_assignments (
      id, project_id, membership_id, role, effective_from,
      effective_to, assigned_by_person_id, created_at
    ) values
      (
        'c0300000-0000-4000-8000-000000000070',
        'c0300000-0000-4000-8000-000000000010',
        'c0300000-0000-4000-8000-000000000069',
        'PROJECT_MEMBER', '2026-01-01T00:00:00Z',
        '2026-03-01T00:00:00Z',
        'c0300000-0000-4000-8000-000000000001',
        '2026-01-01T00:00:00Z'
      ),
      (
        'c0300000-0000-4000-8000-000000000071',
        'c0300000-0000-4000-8000-000000000010',
        'c0300000-0000-4000-8000-000000000069',
        'PROJECT_OBSERVER', '2026-04-01T00:00:00Z', null,
        'c0300000-0000-4000-8000-000000000001',
        '2026-04-01T00:00:00Z'
      );
    set constraints project_memberships_require_ordinary_role immediate;
    raise exception 'Expected ordinary-role gap rejection';
  exception when check_violation then
    if sqlerrm <> 'PROJECT_MEMBERSHIP_ORDINARY_ROLE_COVERAGE_INVALID' then raise; end if;
  end;
end;
$$;


select * from public.change_project_ordinary_role(
  'c0300000-0000-4000-8000-000000000080',
  'c0300000-0000-4000-8000-000000000010',
  'c0300000-0000-4000-8000-000000000020',
  'PROJECT_OBSERVER',
  '2026-04-01T00:00:00Z',
  'c0300000-0000-4000-8000-000000000001',
  'Valid ordinary transition',
  '2026-04-01T00:00:00Z',
  'c0300000-0000-4000-8000-000000000081'
);

select * from public.terminate_project_membership(
  'c0300000-0000-4000-8000-000000000010',
  'c0300000-0000-4000-8000-000000000020',
  '2026-05-01T00:00:00Z',
  'c0300000-0000-4000-8000-000000000001',
  'Valid structural termination',
  'c0300000-0000-4000-8000-000000000082'
);

set constraints all immediate;


do $$
begin
  if not exists (
    select 1
    from public.project_memberships membership
    where membership.id = 'c0300000-0000-4000-8000-000000000020'
      and membership.membership_status = 'ENDED'
      and membership.effective_to = '2026-05-01T00:00:00Z'
      and membership.status = 'active'
  ) then
    raise exception 'Valid lifecycle RPC did not preserve canonical/legacy state';
  end if;

  if exists (
    select 1
    from public.project_role_assignments assignment
    where assignment.membership_id =
        'c0300000-0000-4000-8000-000000000020'
      and assignment.effective_to is null
  ) then
    raise exception 'Valid lifecycle RPC left an open role assignment';
  end if;

  if has_table_privilege(
       'authenticated',
       'public.project_memberships',
       'INSERT,UPDATE,DELETE'
     )
     or has_function_privilege(
       'authenticated',
       'public.add_project_member(uuid,uuid,uuid,timestamptz,timestamptz,uuid,timestamptz,uuid,uuid,timestamptz,uuid)',
       'EXECUTE'
     ) then
    raise exception 'R02 browser boundary regressed';
  end if;

  if exists (
    select required.attname
    from unnest(array[
      'user_id', 'role_id', 'joined_at', 'status', 'created_by'
    ]) required(attname)
    where not exists (
      select 1
      from pg_attribute actual
      where actual.attrelid = 'public.project_memberships'::regclass
        and actual.attname = required.attname
        and not actual.attisdropped
    )
  ) then
    raise exception 'R03C removed a frozen legacy membership column';
  end if;
end;
$$;


select 'R03C_RUNTIME_SMOKE_PASSED' as result;

rollback;
