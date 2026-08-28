-- VS002-07B local transactional producer verification.
-- The entire fixture and verification set rolls back.

\set ON_ERROR_STOP on

begin;

insert into public.persons (id, display_name)
values
  ('07100000-0000-4000-8000-000000000001', 'VS007 Actor'),
  ('07100000-0000-4000-8000-000000000002', 'VS007 Admitted'),
  ('07100000-0000-4000-8000-000000000003', 'VS007 Ordinary'),
  ('07100000-0000-4000-8000-000000000004', 'VS007 Zero History'),
  ('07100000-0000-4000-8000-000000000005', 'VS007 Manager One'),
  ('07100000-0000-4000-8000-000000000006', 'VS007 Manager Two'),
  ('07100000-0000-4000-8000-000000000007', 'VS007 Removed'),
  ('07100000-0000-4000-8000-000000000008', 'VS007 Expired'),
  ('07100000-0000-4000-8000-000000000009', 'VS007 Rollback');

insert into public.users (
  id, username, display_name, email, person_id
)
values (
  '07100000-0000-4000-8000-000000000001',
  'vs007_actor',
  'VS007 Actor',
  'vs007_actor@example.test',
  '07100000-0000-4000-8000-000000000001'
);

insert into public.projects (
  id, name, owner_user_id
)
values (
  '07200000-0000-4000-8000-000000000001',
  'VS002-07B Runtime Project',
  '07100000-0000-4000-8000-000000000001'
);

insert into public.project_memberships (
  id,
  project_id,
  person_id,
  effective_from,
  effective_to,
  membership_status,
  granted_by_person_id,
  created_at
)
values
  ('07300000-0000-4000-8000-000000000003','07200000-0000-4000-8000-000000000001','07100000-0000-4000-8000-000000000003','2026-01-01T00:00:00Z',null,'ACTIVE','07100000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('07300000-0000-4000-8000-000000000004','07200000-0000-4000-8000-000000000001','07100000-0000-4000-8000-000000000004','2026-01-01T00:00:00Z',null,'ACTIVE','07100000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('07300000-0000-4000-8000-000000000005','07200000-0000-4000-8000-000000000001','07100000-0000-4000-8000-000000000005','2026-01-01T00:00:00Z',null,'ACTIVE','07100000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('07300000-0000-4000-8000-000000000006','07200000-0000-4000-8000-000000000001','07100000-0000-4000-8000-000000000006','2026-01-01T00:00:00Z',null,'ACTIVE','07100000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('07300000-0000-4000-8000-000000000007','07200000-0000-4000-8000-000000000001','07100000-0000-4000-8000-000000000007','2026-01-01T00:00:00Z',null,'ACTIVE','07100000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('07300000-0000-4000-8000-000000000008','07200000-0000-4000-8000-000000000001','07100000-0000-4000-8000-000000000008','2026-01-01T00:00:00Z','2026-02-01T00:00:00Z','ACTIVE','07100000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z'),
  ('07300000-0000-4000-8000-000000000009','07200000-0000-4000-8000-000000000001','07100000-0000-4000-8000-000000000009','2026-01-01T00:00:00Z',null,'ACTIVE','07100000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z');

insert into public.project_role_assignments (
  id, project_id, membership_id, role, effective_from,
  effective_to, assigned_by_person_id, change_reason, created_at
)
values
  ('07400000-0000-4000-8000-000000000003','07200000-0000-4000-8000-000000000001','07300000-0000-4000-8000-000000000003','PROJECT_MEMBER','2026-01-01T00:00:00Z',null,'07100000-0000-4000-8000-000000000001','Initial','2026-01-01T00:00:00Z'),
  ('07400000-0000-4000-8000-000000000007','07200000-0000-4000-8000-000000000001','07300000-0000-4000-8000-000000000007','PROJECT_MEMBER','2026-01-01T00:00:00Z',null,'07100000-0000-4000-8000-000000000001','Initial','2026-01-01T00:00:00Z'),
  ('07400000-0000-4000-8000-000000000008','07200000-0000-4000-8000-000000000001','07300000-0000-4000-8000-000000000008','PROJECT_MEMBER','2026-01-01T00:00:00Z','2026-02-01T00:00:00Z','07100000-0000-4000-8000-000000000001','Initial','2026-01-01T00:00:00Z'),
  ('07400000-0000-4000-8000-000000000009','07200000-0000-4000-8000-000000000001','07300000-0000-4000-8000-000000000009','PROJECT_MEMBER','2026-01-01T00:00:00Z',null,'07100000-0000-4000-8000-000000000001','Initial','2026-01-01T00:00:00Z');


-- Admission: exactly MemberAdded + initial RoleAssigned.
select * from public.add_project_member(
  '07300000-0000-4000-8000-000000000002',
  '07200000-0000-4000-8000-000000000001',
  '07100000-0000-4000-8000-000000000002',
  '2026-01-01T00:00:00Z',
  null,
  '07100000-0000-4000-8000-000000000001',
  '2026-01-02T00:00:00Z',
  '07400000-0000-4000-8000-000000000002',
  '07100000-0000-4000-8000-000000000001',
  '2026-01-02T00:00:00Z',
  '07500000-0000-4000-8000-000000000001'
);


-- Ordinary replacement and truthful zero-history compatibility.
select * from public.change_project_ordinary_role(
  '07400000-0000-4000-8000-000000000013',
  '07200000-0000-4000-8000-000000000001',
  '07300000-0000-4000-8000-000000000003',
  'PROJECT_OBSERVER',
  '2026-01-10T00:00:00Z',
  '07100000-0000-4000-8000-000000000001',
  'Observe',
  '2026-01-10T00:00:01Z',
  '07500000-0000-4000-8000-000000000002'
);

select * from public.change_project_ordinary_role(
  '07400000-0000-4000-8000-000000000014',
  '07200000-0000-4000-8000-000000000001',
  '07300000-0000-4000-8000-000000000004',
  'PROJECT_AUDITOR',
  '2026-01-10T00:00:00Z',
  '07100000-0000-4000-8000-000000000001',
  null,
  '2026-01-10T00:00:01Z',
  '07500000-0000-4000-8000-000000000003'
);


-- Protected appointment followed by transfer.
select * from public.transfer_project_protected_role(
  '07600000-0000-4000-8000-000000000001',
  '07400000-0000-4000-8000-000000000015',
  '07200000-0000-4000-8000-000000000001',
  '07300000-0000-4000-8000-000000000005',
  'PROJECT_MANAGER',
  '2026-01-11T00:00:00Z',
  '07100000-0000-4000-8000-000000000001',
  'First Manager',
  '07500000-0000-4000-8000-000000000004',
  '2026-01-11T00:00:01Z'
);

select * from public.transfer_project_protected_role(
  '07600000-0000-4000-8000-000000000002',
  '07400000-0000-4000-8000-000000000016',
  '07200000-0000-4000-8000-000000000001',
  '07300000-0000-4000-8000-000000000006',
  'PROJECT_MANAGER',
  '2026-01-12T00:00:00Z',
  '07100000-0000-4000-8000-000000000001',
  'Transfer Manager',
  '07500000-0000-4000-8000-000000000005',
  '2026-01-12T00:00:01Z'
);


-- Administrative removal and its idempotent retry.
select * from public.terminate_project_membership(
  '07200000-0000-4000-8000-000000000001',
  '07300000-0000-4000-8000-000000000007',
  '2026-01-20T00:00:00Z',
  '07100000-0000-4000-8000-000000000001',
  'Administrative removal',
  '07500000-0000-4000-8000-000000000006'
);

select * from public.terminate_project_membership(
  '07200000-0000-4000-8000-000000000001',
  '07300000-0000-4000-8000-000000000007',
  '2026-01-20T00:00:00Z',
  '07100000-0000-4000-8000-000000000001',
  'Administrative removal',
  '07500000-0000-4000-8000-000000000006'
);


-- Expiry materialisation and its idempotent retry.
select * from public.finalize_project_membership_expiry(
  '07200000-0000-4000-8000-000000000001',
  '07300000-0000-4000-8000-000000000008',
  '2026-02-02T00:00:00Z',
  null,
  '07500000-0000-4000-8000-000000000007'
);

select * from public.finalize_project_membership_expiry(
  '07200000-0000-4000-8000-000000000001',
  '07300000-0000-4000-8000-000000000008',
  '2026-02-03T00:00:00Z',
  null,
  '07500000-0000-4000-8000-000000000008'
);


do $$
declare
  v_types text[];
begin
  select array_agg(event_type order by event_type)
  into v_types
  from public.domain_events
  where correlation_id =
    '07500000-0000-4000-8000-000000000001';

  if v_types <> array[
    'ProjectMemberAdded',
    'ProjectRoleAssigned'
  ] then
    raise exception 'Admission cardinality invalid: %', v_types;
  end if;

  select array_agg(event_type order by event_type)
  into v_types
  from public.domain_events
  where correlation_id =
    '07500000-0000-4000-8000-000000000002';

  if v_types <> array[
    'ProjectRoleAssigned',
    'ProjectRoleRevoked'
  ] then
    raise exception 'Ordinary replacement cardinality invalid: %', v_types;
  end if;

  if (
    select count(*)
    from public.domain_events
    where correlation_id =
      '07500000-0000-4000-8000-000000000003'
      and event_type = 'ProjectRoleAssigned'
  ) <> 1 then
    raise exception 'Zero-history ordinary cardinality invalid';
  end if;

  if (
    select count(*)
    from public.domain_events
    where correlation_id in (
      '07500000-0000-4000-8000-000000000004',
      '07500000-0000-4000-8000-000000000005'
    )
      and event_type in (
        'ProjectRoleAssigned',
        'ProjectRoleTransferred'
      )
  ) <> 2 then
    raise exception 'Protected operation cardinality invalid';
  end if;

  if (
    select count(*)
    from public.domain_events
    where correlation_id =
      '07500000-0000-4000-8000-000000000006'
      and event_type = 'ProjectMemberRemoved'
  ) <> 1 then
    raise exception 'Removal retry emitted a duplicate';
  end if;

  if (
    select count(*)
    from public.domain_events
    where aggregate_id =
      '07300000-0000-4000-8000-000000000008'
      and event_type = 'ProjectMembershipExpired'
  ) <> 1 then
    raise exception 'Expiry retry emitted a duplicate';
  end if;

  if exists (
    select 1
    from public.domain_events
    where correlation_id between
      '07500000-0000-4000-8000-000000000001'
      and
      '07500000-0000-4000-8000-000000000008'
      and (
        event_version <> 1
        or project_id <>
          '07200000-0000-4000-8000-000000000001'
        or (
          event_type <> 'ProjectMembershipExpired'
          and (
            actor_type <> 'person'
            or actor_id <>
              '07100000-0000-4000-8000-000000000001'
          )
        )
        or (
          event_type = 'ProjectMembershipExpired'
          and (
            actor_type <> 'system'
            or actor_id is not null
          )
        )
      )
  ) then
    raise exception 'Envelope provenance invalid';
  end if;

  if not exists (
    select 1
    from public.domain_events
    where event_type = 'ProjectMemberRemoved'
      and payload ? 'before'
      and payload ? 'after'
      and payload ? 'closed_role_assignments'
      and payload ? 'termination'
  ) then
    raise exception 'Removal payload is incomplete';
  end if;

  if not exists (
    select 1
    from public.domain_events
    where event_type = 'ProjectMembershipExpired'
      and payload ->> 'effective_at' =
        '2026-02-01T00:00:00+00:00'
      and payload ->> 'materialized_at' =
        '2026-02-02T00:00:00+00:00'
      and payload ? 'ended_role_assignments'
  ) then
    raise exception 'Expiry payload boundary/materialisation invalid';
  end if;
end;
$$;


-- A producer failure after the state mutation must roll the statement back.
create function pg_temp.reject_vs002_07_event()
returns trigger
language plpgsql
as $$
begin
  if new.correlation_id =
    '07500000-0000-4000-8000-000000000009' then
    raise exception 'VS002_07_FORCED_EVENT_FAILURE';
  end if;
  return new;
end;
$$;

create trigger vs002_07_reject_event
before insert on public.domain_events
for each row execute function
  pg_temp.reject_vs002_07_event();

do $$
begin
  begin
    perform *
    from public.change_project_ordinary_role(
      '07400000-0000-4000-8000-000000000019',
      '07200000-0000-4000-8000-000000000001',
      '07300000-0000-4000-8000-000000000009',
      'PROJECT_OBSERVER',
      '2026-01-21T00:00:00Z',
      '07100000-0000-4000-8000-000000000001',
      'Must roll back',
      '2026-01-21T00:00:01Z',
      '07500000-0000-4000-8000-000000000009'
    );
    raise exception 'Expected forced event failure';
  exception
    when others then
      if sqlerrm not like '%VS002_07_FORCED_EVENT_FAILURE%' then
        raise;
      end if;
  end;

  if exists (
    select 1
    from public.project_role_assignments
    where id =
      '07400000-0000-4000-8000-000000000019'
  ) then
    raise exception 'Mutation survived event failure';
  end if;

  if (
    select effective_to
    from public.project_role_assignments
    where id =
      '07400000-0000-4000-8000-000000000009'
  ) is not null then
    raise exception 'Historical assignment closure survived event failure';
  end if;

  if exists (
    select 1
    from public.domain_events
    where correlation_id =
      '07500000-0000-4000-8000-000000000009'
  ) then
    raise exception 'Failed operation retained an event';
  end if;
end;
$$;

drop trigger vs002_07_reject_event
  on public.domain_events;

rollback;
