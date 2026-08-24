-- VS002-05B local PostgreSQL runtime verification.
-- Run only after a clean local `supabase db reset`.
-- Fixtures use deterministic IDs and do not depend on remote data.

\set ON_ERROR_STOP on

insert into public.persons (id, display_name)
values
  ('10000000-0000-4000-8000-000000000001', 'VS005 Actor'),
  ('20000000-0000-4000-8000-000000000001', 'Ordinary Member'),
  ('20000000-0000-4000-8000-000000000002', 'External Manager'),
  ('20000000-0000-4000-8000-000000000003', 'Incoming Manager'),
  ('20000000-0000-4000-8000-000000000004', 'Rollback Target'),
  ('20000000-0000-4000-8000-000000000005', 'Legacy Compatibility'),
  ('20000000-0000-4000-8000-000000000006', 'Invalid Ordinary State'),
  ('20000000-0000-4000-8000-000000000007', 'Future Member'),
  ('20000000-0000-4000-8000-000000000008', 'Bounded Member'),
  ('20000000-0000-4000-8000-000000000009', 'Other Project Member'),
  ('20000000-0000-4000-8000-000000000010', 'Protected Invalid State'),
  ('20000000-0000-4000-8000-000000000011', 'Owner Holder'),
  ('20000000-0000-4000-8000-000000000012', 'Sponsor Holder'),
  ('30000000-0000-4000-8000-000000000001', 'Concurrent Manager One'),
  ('30000000-0000-4000-8000-000000000002', 'Concurrent Manager Two'),
  ('30000000-0000-4000-8000-000000000003', 'Concurrent Ordinary');

insert into public.users (
  id, username, display_name, email, person_id
)
values (
  '10000000-0000-4000-8000-000000000001',
  'vs005_actor',
  'VS005 Actor',
  'vs005_actor@example.test',
  '10000000-0000-4000-8000-000000000001'
);

insert into public.projects (
  id, name, owner_user_id
)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'VS005 Runtime Project',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    'b0000000-0000-4000-8000-000000000001',
    'VS005 Other Project',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    'c0000000-0000-4000-8000-000000000001',
    'VS005 Protected Concurrency',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    'd0000000-0000-4000-8000-000000000001',
    'VS005 Ordinary Concurrency',
    '10000000-0000-4000-8000-000000000001'
  );

insert into public.organisational_affiliations (
  id, person_id, classification, organisation_name, effective_from
)
values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'EXTERNAL',
  'External Delivery Ltd',
  '2026-01-01T00:00:00Z'
);

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
  created_at
)
values
  ('50000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000001',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000002',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000003',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000004',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000005',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000006',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000001',null,null,'active','2027-01-01T00:00:00Z','20000000-0000-4000-8000-000000000007',null,'10000000-0000-4000-8000-000000000001','2027-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000008','2026-06-01T00:00:00Z','10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000009',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000010',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000011',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('50000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','20000000-0000-4000-8000-000000000012',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('60000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','30000000-0000-4000-8000-000000000001',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('60000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','30000000-0000-4000-8000-000000000002',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('70000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',null,null,'active','2026-01-01T00:00:00Z','30000000-0000-4000-8000-000000000003',null,'10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z');

insert into public.project_role_assignments (
  id, project_id, membership_id, role, effective_from,
  effective_to, assigned_by_person_id, change_reason, created_at
)
values
  ('80000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','PROJECT_MEMBER','2026-01-01T00:00:00Z',null,'10000000-0000-4000-8000-000000000001','Initial','2026-01-01T00:00:00Z'),
  ('80000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000006','PROJECT_MEMBER','2026-01-01T00:00:00Z',null,'10000000-0000-4000-8000-000000000001','Invalid one','2026-01-01T00:00:00Z'),
  ('80000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000006','PROJECT_OBSERVER','2026-01-01T00:00:00Z',null,'10000000-0000-4000-8000-000000000001','Invalid two','2026-01-01T00:00:00Z'),
  ('80000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','PROJECT_MEMBER','2026-01-01T00:00:00Z',null,'10000000-0000-4000-8000-000000000001','Concurrency initial','2026-01-01T00:00:00Z');


-- Ordinary role changes and persisted history.
select * from public.change_project_ordinary_role(
  '81000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'PROJECT_OBSERVER',
  '2026-02-01T00:00:00Z',
  '10000000-0000-4000-8000-000000000001',
  'Observe only',
  '2026-02-01T00:00:00Z'
);

select * from public.change_project_ordinary_role(
  '81000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'PROJECT_AUDITOR',
  '2026-03-01T00:00:00Z',
  '10000000-0000-4000-8000-000000000001',
  'Independent assurance',
  '2026-03-01T00:00:00Z'
);

-- Zero prior frozen role: truthful migrated VS-001 compatibility.
select * from public.change_project_ordinary_role(
  '81000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000005',
  'PROJECT_MEMBER',
  '2026-02-01T00:00:00Z',
  '10000000-0000-4000-8000-000000000001',
  'First frozen role',
  '2026-02-01T00:00:00Z'
);

-- Bounded membership propagates its upper bound.
select * from public.change_project_ordinary_role(
  '81000000-0000-4000-8000-000000000004',
  'a0000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000008',
  'PROJECT_OBSERVER',
  '2026-02-01T00:00:00Z',
  '10000000-0000-4000-8000-000000000001',
  'Bounded observer',
  '2026-02-01T00:00:00Z'
);

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.project_role_assignments
  where membership_id = '50000000-0000-4000-8000-000000000001';
  if v_count <> 3 then
    raise exception 'Expected three ordinary history rows, found %', v_count;
  end if;

  if not exists (
    select 1 from public.project_role_assignments
    where id = '80000000-0000-4000-8000-000000000001'
      and effective_to = '2026-02-01T00:00:00Z'
  ) or not exists (
    select 1 from public.project_role_assignments
    where id = '81000000-0000-4000-8000-000000000001'
      and effective_to = '2026-03-01T00:00:00Z'
  ) then
    raise exception 'Ordinary history was not closed at transition times';
  end if;

  if not exists (
    select 1 from public.project_role_assignments
    where id = '81000000-0000-4000-8000-000000000002'
      and role = 'PROJECT_AUDITOR'
      and assigned_by_person_id = '10000000-0000-4000-8000-000000000001'
      and change_reason = 'Independent assurance'
      and effective_to is null
  ) then
    raise exception 'New ordinary role provenance was not preserved';
  end if;

  if not exists (
    select 1 from public.project_role_assignments
    where id = '81000000-0000-4000-8000-000000000004'
      and effective_to = '2026-06-01T00:00:00Z'
  ) then
    raise exception 'Bounded membership did not bound ordinary assignment';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.change_project_ordinary_role(
      '82000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','PROJECT_AUDITOR','2026-04-01T00:00:00Z','10000000-0000-4000-8000-000000000001','Same role','2026-04-01T00:00:00Z'
    );
    raise exception 'Expected same-role rejection';
  exception when others then
    if sqlerrm not like '%PROJECT_ROLE_ORDINARY_UNCHANGED%' then raise; end if;
  end;

  begin
    perform public.change_project_ordinary_role(
      '82000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','PROJECT_MANAGER','2026-04-01T00:00:00Z','10000000-0000-4000-8000-000000000001','Wrong path','2026-04-01T00:00:00Z'
    );
    raise exception 'Expected protected-role rejection';
  exception when others then
    if sqlerrm not like '%PROJECT_ROLE_TRANSFER_REQUIRED%' then raise; end if;
  end;

  begin
    perform public.change_project_ordinary_role(
      '82000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000006','PROJECT_AUDITOR','2026-04-01T00:00:00Z','10000000-0000-4000-8000-000000000001','Invalid state','2026-04-01T00:00:00Z'
    );
    raise exception 'Expected ordinary-cardinality rejection';
  exception when others then
    if sqlerrm not like '%PROJECT_ROLE_ORDINARY_CARDINALITY_INVALID%' then raise; end if;
  end;

  begin
    perform public.change_project_ordinary_role(
      '82000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000009','PROJECT_MEMBER','2026-04-01T00:00:00Z','10000000-0000-4000-8000-000000000001','Wrong project','2026-04-01T00:00:00Z'
    );
    raise exception 'Expected wrong-project rejection';
  exception when others then
    if sqlerrm not like '%PROJECT_MEMBERSHIP_PROJECT_MISMATCH%' then raise; end if;
  end;

  begin
    perform public.change_project_ordinary_role(
      '82000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000007','PROJECT_MEMBER','2026-04-01T00:00:00Z','10000000-0000-4000-8000-000000000001','Too early','2026-04-01T00:00:00Z'
    );
    raise exception 'Expected ineffective-membership rejection';
  exception when others then
    if sqlerrm not like '%PROJECT_MEMBERSHIP_NOT_EFFECTIVE%' then raise; end if;
  end;
end;
$$;


-- Protected PROJECT_MANAGER first appointment to an EXTERNAL member.
select * from public.transfer_project_protected_role(
  '90000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  'PROJECT_MANAGER',
  '2026-02-01T00:00:00Z',
  '10000000-0000-4000-8000-000000000001',
  'External delivery leadership',
  '92000000-0000-4000-8000-000000000001',
  '2026-02-01T00:00:00Z'
);

-- Manager transfer.
select * from public.transfer_project_protected_role(
  '90000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000003',
  'PROJECT_MANAGER',
  '2026-03-01T00:00:00Z',
  '10000000-0000-4000-8000-000000000001',
  'Manager succession',
  '92000000-0000-4000-8000-000000000002',
  '2026-03-01T00:00:00Z'
);

-- Smoke first appointments for the other two protected roles.
select * from public.transfer_project_protected_role(
  '90000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000011','PROJECT_OWNER','2026-02-01T00:00:00Z','10000000-0000-4000-8000-000000000001','First owner','92000000-0000-4000-8000-000000000003','2026-02-01T00:00:00Z'
);
select * from public.transfer_project_protected_role(
  '90000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000012','PROJECT_SPONSOR','2026-02-01T00:00:00Z','10000000-0000-4000-8000-000000000001','First sponsor','92000000-0000-4000-8000-000000000004','2026-02-01T00:00:00Z'
);

do $$
begin
  if not exists (
    select 1
    from public.organisational_affiliations affiliation
    join public.project_memberships membership
      on membership.person_id = affiliation.person_id
    join public.project_role_assignments assignment
      on assignment.membership_id = membership.id
    where affiliation.classification = 'EXTERNAL'
      and assignment.id = '91000000-0000-4000-8000-000000000001'
      and assignment.role = 'PROJECT_MANAGER'
      and assignment.effective_to = '2026-03-01T00:00:00Z'
  ) then
    raise exception 'External Project Manager appointment/history missing';
  end if;

  if not exists (
    select 1 from public.project_role_transfers
    where id = '90000000-0000-4000-8000-000000000001'
      and outgoing_assignment_id is null
      and incoming_assignment_id = '91000000-0000-4000-8000-000000000001'
      and authorised_by_person_id = '10000000-0000-4000-8000-000000000001'
      and reason = 'External delivery leadership'
      and correlation_id = '92000000-0000-4000-8000-000000000001'
      and role = 'PROJECT_MANAGER'
      and effective_at = '2026-02-01T00:00:00Z'
  ) then
    raise exception 'First appointment ledger provenance mismatch';
  end if;

  if not exists (
    select 1 from public.project_role_transfers
    where id = '90000000-0000-4000-8000-000000000002'
      and outgoing_assignment_id = '91000000-0000-4000-8000-000000000001'
      and incoming_assignment_id = '91000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Transfer ledger assignment links mismatch';
  end if;
end;
$$;

-- Duplicate ledger ID forces failure after outgoing close and incoming insert.
-- The statement transaction must roll both changes back.
do $$
begin
  begin
    perform public.transfer_project_protected_role(
      '90000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000004','PROJECT_MANAGER','2026-04-01T00:00:00Z','10000000-0000-4000-8000-000000000001','Rollback verification','92000000-0000-4000-8000-000000000005','2026-04-01T00:00:00Z'
    );
    raise exception 'Expected duplicate-ledger failure';
  exception when unique_violation then
    null;
  end;

  if exists (
    select 1 from public.project_role_assignments
    where id = '91000000-0000-4000-8000-000000000005'
  ) or exists (
    select 1 from public.project_role_assignments
    where id = '91000000-0000-4000-8000-000000000002'
      and effective_to is not null
  ) then
    raise exception 'Protected transfer failure left partial assignment state';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.transfer_project_protected_role(
      '90000000-0000-4000-8000-000000000006','91000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','PROJECT_MANAGER','2026-04-01T00:00:00Z','10000000-0000-4000-8000-000000000001','Same holder','92000000-0000-4000-8000-000000000006','2026-04-01T00:00:00Z'
    );
    raise exception 'Expected same-holder rejection';
  exception when others then
    if sqlerrm not like '%PROJECT_ROLE_PROTECTED_HOLDER_UNCHANGED%' then raise; end if;
  end;

  begin
    perform public.transfer_project_protected_role(
      '90000000-0000-4000-8000-000000000007','91000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000009','PROJECT_MANAGER','2026-04-01T00:00:00Z','10000000-0000-4000-8000-000000000001','Wrong project','92000000-0000-4000-8000-000000000007','2026-04-01T00:00:00Z'
    );
    raise exception 'Expected wrong-project rejection';
  exception when others then
    if sqlerrm not like '%PROJECT_MEMBERSHIP_PROJECT_MISMATCH%' then raise; end if;
  end;

  begin
    perform public.transfer_project_protected_role(
      '90000000-0000-4000-8000-000000000008','91000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000007','PROJECT_MANAGER','2026-04-01T00:00:00Z','10000000-0000-4000-8000-000000000001','Too early','92000000-0000-4000-8000-000000000008','2026-04-01T00:00:00Z'
    );
    raise exception 'Expected ineffective incoming rejection';
  exception when others then
    if sqlerrm not like '%PROJECT_MEMBERSHIP_NOT_EFFECTIVE%' then raise; end if;
  end;
end;
$$;

-- Safely manufacture invalid protected cardinality only after valid manager tests.
insert into public.project_role_assignments (
  id, project_id, membership_id, role, effective_from,
  effective_to, assigned_by_person_id, change_reason, created_at
)
values (
  '91000000-0000-4000-8000-000000000009',
  'a0000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000010',
  'PROJECT_MANAGER',
  '2026-03-15T00:00:00Z',
  null,
  '10000000-0000-4000-8000-000000000001',
  'Invalid concurrent holder fixture',
  '2026-03-15T00:00:00Z'
);

do $$
begin
  begin
    perform public.transfer_project_protected_role(
      '90000000-0000-4000-8000-000000000009','91000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000004','PROJECT_MANAGER','2026-04-01T00:00:00Z','10000000-0000-4000-8000-000000000001','Invalid state','92000000-0000-4000-8000-000000000009','2026-04-01T00:00:00Z'
    );
    raise exception 'Expected protected-cardinality rejection';
  exception when others then
    if sqlerrm not like '%PROJECT_ROLE_PROTECTED_CARDINALITY_INVALID%' then raise; end if;
  end;
end;
$$;


-- Immutability and hard-delete guards.
do $$
begin
  begin
    delete from public.project_role_assignments
    where id = '80000000-0000-4000-8000-000000000001';
    raise exception 'Expected role-assignment hard-delete rejection';
  exception when sqlstate '55000' then null;
  end;

  begin
    update public.project_role_transfers
    set reason = 'Tampered'
    where id = '90000000-0000-4000-8000-000000000001';
    raise exception 'Expected transfer-ledger update rejection';
  exception when sqlstate '55000' then null;
  end;

  begin
    delete from public.project_role_transfers
    where id = '90000000-0000-4000-8000-000000000001';
    raise exception 'Expected transfer-ledger delete rejection';
  exception when sqlstate '55000' then null;
  end;
end;
$$;


-- Actual migrated privilege and legacy-permission state.
do $$
declare
  v_owner_holders integer;
  v_compatible_holders integer;
begin
  if has_function_privilege(
    'anon',
    'public.change_project_ordinary_role(uuid,uuid,uuid,text,timestamptz,uuid,text,timestamptz)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.change_project_ordinary_role(uuid,uuid,uuid,text,timestamptz,uuid,text,timestamptz)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.transfer_project_protected_role(uuid,uuid,uuid,uuid,text,timestamptz,uuid,text,uuid,timestamptz)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.transfer_project_protected_role(uuid,uuid,uuid,uuid,text,timestamptz,uuid,text,uuid,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'Browser role unexpectedly has role-management RPC execution';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.change_project_ordinary_role(uuid,uuid,uuid,text,timestamptz,uuid,text,timestamptz)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.transfer_project_protected_role(uuid,uuid,uuid,uuid,text,timestamptz,uuid,text,uuid,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'Service role lacks role-management RPC execution';
  end if;

  if has_table_privilege('anon', 'public.project_role_transfers', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.project_role_transfers', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'public.project_role_transfers', 'INSERT,UPDATE,DELETE') then
    raise exception 'Normal database role can directly mutate transfer ledger';
  end if;

  if not exists (select 1 from public.permissions where code = 'member.assign_manager')
     or not exists (select 1 from public.permissions where code = 'member.assign_sponsor') then
    raise exception 'Missing protected-assignment compatibility permissions';
  end if;

  select count(distinct rp.role_id) into v_owner_holders
  from public.role_permissions rp
  join public.permissions p on p.id = rp.permission_id
  where p.code = 'member.assign_owner';

  select count(distinct owner_grant.role_id) into v_compatible_holders
  from public.role_permissions owner_grant
  join public.permissions owner_permission
    on owner_permission.id = owner_grant.permission_id
   and owner_permission.code = 'member.assign_owner'
  where exists (
    select 1 from public.role_permissions manager_grant
    join public.permissions manager_permission
      on manager_permission.id = manager_grant.permission_id
    where manager_grant.role_id = owner_grant.role_id
      and manager_permission.code = 'member.assign_manager'
  ) and exists (
    select 1 from public.role_permissions sponsor_grant
    join public.permissions sponsor_permission
      on sponsor_permission.id = sponsor_grant.permission_id
    where sponsor_grant.role_id = owner_grant.role_id
      and sponsor_permission.code = 'member.assign_sponsor'
  );

  if v_owner_holders <> v_compatible_holders then
    raise exception 'Not every assign-owner holder received both missing permissions';
  end if;

  if exists (
    select 1
    from public.role_permissions added
    join public.permissions added_permission
      on added_permission.id = added.permission_id
     and added_permission.code in ('member.assign_manager','member.assign_sponsor')
    where not exists (
      select 1
      from public.role_permissions owner_grant
      join public.permissions owner_permission
        on owner_permission.id = owner_grant.permission_id
       and owner_permission.code = 'member.assign_owner'
      where owner_grant.role_id = added.role_id
    )
  ) then
    raise exception 'Unrelated role gained protected-assignment authority';
  end if;
end;
$$;

do $$
begin
  raise notice 'VS002-05B runtime smoke test passed; concurrency fixtures ready.';
end;
$$;
