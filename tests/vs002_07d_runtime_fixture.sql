-- VS002-07D local end-to-end worker fixture.
-- This committed fixture is isolated to deterministic 07d UUIDs so the
-- external worker process can consume its domain-event deliveries.

\set ON_ERROR_STOP on

begin;

insert into public.persons (id, display_name)
values
  ('07d10000-0000-4000-8000-000000000001', 'VS002-07D QA Actor'),
  ('07d10000-0000-4000-8000-000000000002', 'VS002-07D QA Admitted'),
  ('07d10000-0000-4000-8000-000000000003', 'VS002-07D QA Ordinary'),
  ('07d10000-0000-4000-8000-000000000004', 'VS002-07D QA Zero History'),
  ('07d10000-0000-4000-8000-000000000005', 'VS002-07D QA Manager One'),
  ('07d10000-0000-4000-8000-000000000006', 'VS002-07D QA Manager Two'),
  ('07d10000-0000-4000-8000-000000000007', 'VS002-07D QA Removed'),
  ('07d10000-0000-4000-8000-000000000008', 'VS002-07D QA Expired');

insert into public.users (
  id, username, display_name, email, person_id
)
values (
  '07d10000-0000-4000-8000-000000000001',
  'vs002_07d_actor',
  'VS002-07D QA Actor',
  'vs002_07d_actor@example.test',
  '07d10000-0000-4000-8000-000000000001'
);

insert into public.projects (id, name, owner_user_id)
values (
  '07d20000-0000-4000-8000-000000000001',
  'VS002-07D QA Runtime Project',
  '07d10000-0000-4000-8000-000000000001'
);

insert into public.project_memberships (
  id, project_id, person_id, effective_from, effective_to,
  membership_status, granted_by_person_id, created_at
)
values
  ('07d30000-0000-4000-8000-000000000003','07d20000-0000-4000-8000-000000000001','07d10000-0000-4000-8000-000000000003','2026-08-01T00:00:00Z',null,'ACTIVE','07d10000-0000-4000-8000-000000000001','2026-08-01T00:00:00Z'),
  ('07d30000-0000-4000-8000-000000000004','07d20000-0000-4000-8000-000000000001','07d10000-0000-4000-8000-000000000004','2026-08-01T00:00:00Z',null,'ACTIVE','07d10000-0000-4000-8000-000000000001','2026-08-01T00:00:00Z'),
  ('07d30000-0000-4000-8000-000000000005','07d20000-0000-4000-8000-000000000001','07d10000-0000-4000-8000-000000000005','2026-08-01T00:00:00Z',null,'ACTIVE','07d10000-0000-4000-8000-000000000001','2026-08-01T00:00:00Z'),
  ('07d30000-0000-4000-8000-000000000006','07d20000-0000-4000-8000-000000000001','07d10000-0000-4000-8000-000000000006','2026-08-01T00:00:00Z',null,'ACTIVE','07d10000-0000-4000-8000-000000000001','2026-08-01T00:00:00Z'),
  ('07d30000-0000-4000-8000-000000000007','07d20000-0000-4000-8000-000000000001','07d10000-0000-4000-8000-000000000007','2026-08-01T00:00:00Z',null,'ACTIVE','07d10000-0000-4000-8000-000000000001','2026-08-01T00:00:00Z'),
  ('07d30000-0000-4000-8000-000000000008','07d20000-0000-4000-8000-000000000001','07d10000-0000-4000-8000-000000000008','2026-08-01T00:00:00Z','2026-08-23T00:00:00Z','ACTIVE','07d10000-0000-4000-8000-000000000001','2026-08-01T00:00:00Z');

insert into public.project_role_assignments (
  id, project_id, membership_id, role, effective_from, effective_to,
  assigned_by_person_id, change_reason, created_at
)
values
  ('07d40000-0000-4000-8000-000000000003','07d20000-0000-4000-8000-000000000001','07d30000-0000-4000-8000-000000000003','PROJECT_MEMBER','2026-08-01T00:00:00Z',null,'07d10000-0000-4000-8000-000000000001','VS002-07D initial ordinary','2026-08-01T00:00:00Z'),
  ('07d40000-0000-4000-8000-000000000007','07d20000-0000-4000-8000-000000000001','07d30000-0000-4000-8000-000000000007','PROJECT_MEMBER','2026-08-01T00:00:00Z',null,'07d10000-0000-4000-8000-000000000001','VS002-07D removable ordinary','2026-08-01T00:00:00Z'),
  ('07d40000-0000-4000-8000-000000000008','07d20000-0000-4000-8000-000000000001','07d30000-0000-4000-8000-000000000008','PROJECT_OBSERVER','2026-08-01T00:00:00Z','2026-08-23T00:00:00Z','07d10000-0000-4000-8000-000000000001','VS002-07D expiring ordinary','2026-08-01T00:00:00Z');

-- Admission: MemberAdded + initial ordinary RoleAssigned.
select * from public.add_project_member(
  '07d30000-0000-4000-8000-000000000002',
  '07d20000-0000-4000-8000-000000000001',
  '07d10000-0000-4000-8000-000000000002',
  '2026-08-01T00:00:00Z', null,
  '07d10000-0000-4000-8000-000000000001',
  '2026-08-24T01:00:00Z',
  '07d40000-0000-4000-8000-000000000002',
  '07d10000-0000-4000-8000-000000000001',
  '2026-08-24T01:00:00Z',
  '07d50000-0000-4000-8000-000000000001'
);

-- Ordinary replacement and truthful zero-history compatibility.
select * from public.change_project_ordinary_role(
  '07d40000-0000-4000-8000-000000000013',
  '07d20000-0000-4000-8000-000000000001',
  '07d30000-0000-4000-8000-000000000003',
  'PROJECT_OBSERVER', '2026-08-24T02:00:00Z',
  '07d10000-0000-4000-8000-000000000001',
  'VS002-07D ordinary replacement', '2026-08-24T02:00:01Z',
  '07d50000-0000-4000-8000-000000000002'
);

select * from public.change_project_ordinary_role(
  '07d40000-0000-4000-8000-000000000014',
  '07d20000-0000-4000-8000-000000000001',
  '07d30000-0000-4000-8000-000000000004',
  'PROJECT_AUDITOR', '2026-08-24T02:00:00Z',
  '07d10000-0000-4000-8000-000000000001',
  'VS002-07D zero history', '2026-08-24T02:00:01Z',
  '07d50000-0000-4000-8000-000000000003'
);

-- First protected appointment and subsequent transfer.
select * from public.transfer_project_protected_role(
  '07d60000-0000-4000-8000-000000000001',
  '07d40000-0000-4000-8000-000000000015',
  '07d20000-0000-4000-8000-000000000001',
  '07d30000-0000-4000-8000-000000000005',
  'PROJECT_MANAGER', '2026-08-24T03:00:00Z',
  '07d10000-0000-4000-8000-000000000001',
  'VS002-07D first Manager',
  '07d50000-0000-4000-8000-000000000004',
  '2026-08-24T03:00:01Z'
);

select * from public.transfer_project_protected_role(
  '07d60000-0000-4000-8000-000000000002',
  '07d40000-0000-4000-8000-000000000016',
  '07d20000-0000-4000-8000-000000000001',
  '07d30000-0000-4000-8000-000000000006',
  'PROJECT_MANAGER', '2026-08-24T04:00:00Z',
  '07d10000-0000-4000-8000-000000000001',
  'VS002-07D Manager transfer',
  '07d50000-0000-4000-8000-000000000005',
  '2026-08-24T04:00:01Z'
);

-- Administrative removal; its closed assignment remains historical.
select * from public.terminate_project_membership(
  '07d20000-0000-4000-8000-000000000001',
  '07d30000-0000-4000-8000-000000000007',
  '2026-08-24T05:00:00Z',
  '07d10000-0000-4000-8000-000000000001',
  'VS002-07D administrative removal',
  '07d50000-0000-4000-8000-000000000006'
);

do $$
begin
  if (select count(*) from public.domain_events where project_id = '07d20000-0000-4000-8000-000000000001') <> 8 then
    raise exception 'Expected eight pre-expiry domain events';
  end if;

  if (select count(*) from public.domain_event_deliveries d join public.domain_events e on e.id = d.event_id where e.project_id = '07d20000-0000-4000-8000-000000000001' and d.consumer_name = 'audit.domain-events.v1') <> 8 then
    raise exception 'Expected eight pre-expiry Audit deliveries';
  end if;

  if (select count(*) from public.project_memberships where membership_status = 'ACTIVE' and effective_to is not null and effective_to <= now()) <> 1 then
    raise exception 'The isolated expiry fixture is not the only due membership';
  end if;

  if not exists (
    select 1 from public.project_memberships
    where id = '07d30000-0000-4000-8000-000000000008'
      and membership_status = 'ACTIVE'
      and effective_to <= now()
  ) then
    raise exception 'Expected VS002-07D expiry fixture is not due';
  end if;
end;
$$;

commit;

select 'VS002_07D_FIXTURE_READY' as result;
