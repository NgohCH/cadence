-- R03D local PostgreSQL runtime verification.
-- Run only after a clean local `supabase db reset`.

\set ON_ERROR_STOP on

begin;

insert into public.persons (id, display_name)
values
  ('d0400000-0000-4000-8000-000000000001', 'R03D Actor'),
  ('d0400000-0000-4000-8000-000000000002', 'R03D Member One'),
  ('d0400000-0000-4000-8000-000000000003', 'R03D Member Two'),
  ('d0400000-0000-4000-8000-000000000004', 'R03D Rewrite Target');

insert into public.users (id, username, display_name, email, person_id)
values (
  'd0400000-0000-4000-8000-000000000001',
  'r03d_actor',
  'R03D Actor',
  'r03d_actor@example.test',
  'd0400000-0000-4000-8000-000000000001'
);

insert into public.projects (id, name, owner_user_id)
values (
  'd0400000-0000-4000-8000-000000000010',
  'R03D Runtime Project',
  'd0400000-0000-4000-8000-000000000001'
);

select * from public.add_project_member(
  'd0400000-0000-4000-8000-000000000020',
  'd0400000-0000-4000-8000-000000000010',
  'd0400000-0000-4000-8000-000000000002',
  '2026-01-01T00:00:00Z', null,
  'd0400000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z',
  'd0400000-0000-4000-8000-000000000030',
  'd0400000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z',
  'd0400000-0000-4000-8000-000000000040'
);

select * from public.add_project_member(
  'd0400000-0000-4000-8000-000000000021',
  'd0400000-0000-4000-8000-000000000010',
  'd0400000-0000-4000-8000-000000000003',
  '2026-01-01T00:00:00Z', null,
  'd0400000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z',
  'd0400000-0000-4000-8000-000000000031',
  'd0400000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z',
  'd0400000-0000-4000-8000-000000000041'
);

select * from public.transfer_project_protected_role(
  'd0400000-0000-4000-8000-000000000050',
  'd0400000-0000-4000-8000-000000000051',
  'd0400000-0000-4000-8000-000000000010',
  'd0400000-0000-4000-8000-000000000021',
  'PROJECT_MANAGER',
  '2026-02-01T00:00:00Z',
  'd0400000-0000-4000-8000-000000000001',
  'Initial manager',
  'd0400000-0000-4000-8000-000000000052',
  '2026-02-01T00:00:00Z'
);

select * from public.terminate_project_membership(
  'd0400000-0000-4000-8000-000000000010',
  'd0400000-0000-4000-8000-000000000020',
  '2026-03-01T00:00:00Z',
  'd0400000-0000-4000-8000-000000000001',
  'R03D valid termination',
  'd0400000-0000-4000-8000-000000000060'
);

set constraints all immediate;

do $$
begin
  begin
    update public.project_memberships
    set person_id = 'd0400000-0000-4000-8000-000000000004'
    where id = 'd0400000-0000-4000-8000-000000000020';
    raise exception 'Expected historical membership identity rejection';
  exception when sqlstate '55000' then
    if sqlerrm <> 'PROJECT_MEMBERSHIP_IDENTITY_PROVENANCE_IMMUTABLE' then
      raise;
    end if;
  end;

  begin
    update public.project_role_assignments
    set change_reason = 'rewritten closed history'
    where id = 'd0400000-0000-4000-8000-000000000030';
    raise exception 'Expected closed ordinary role rejection';
  exception when sqlstate '55000' then
    if sqlerrm <> 'PROJECT_ROLE_ASSIGNMENT_HISTORY_IMMUTABLE' then
      raise;
    end if;
  end;

  begin
    update public.project_role_assignments
    set change_reason = 'diverge from immutable transfer ledger'
    where id = 'd0400000-0000-4000-8000-000000000051';
    raise exception 'Expected protected transfer divergence rejection';
  exception when sqlstate '55000' then
    if sqlerrm <> 'PROJECT_ROLE_ASSIGNMENT_FORWARD_CLOSE_REQUIRED' then
      raise;
    end if;
  end;

  begin
    delete from public.project_memberships
    where id = 'd0400000-0000-4000-8000-000000000020';
    raise exception 'Expected direct membership deletion rejection';
  exception when sqlstate '55000' then null;
  end;

  begin
    delete from public.projects
    where id = 'd0400000-0000-4000-8000-000000000010';
    raise exception 'Expected parent cascade deletion rejection';
  exception when sqlstate '55000' then null;
  end;

  begin
    execute 'truncate public.project_memberships cascade';
    raise exception 'Expected owner truncate trigger rejection';
  exception when sqlstate '55000' then
    if sqlerrm <> 'HISTORICAL_MEMBERSHIP_TRUNCATE_FORBIDDEN' then
      raise;
    end if;
  end;
end;
$$;

set local role service_role;

do $$
begin
  begin
    update public.project_memberships
    set granted_by_person_id = 'd0400000-0000-4000-8000-000000000004'
    where id = 'd0400000-0000-4000-8000-000000000020';
    raise exception 'Expected service-role update rejection';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.project_role_assignments
    where id = 'd0400000-0000-4000-8000-000000000030';
    raise exception 'Expected service-role delete rejection';
  exception when insufficient_privilege then null;
  end;

  begin
    execute 'truncate public.project_memberships cascade';
    raise exception 'Expected service-role truncate rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
begin
  if has_table_privilege(
       'service_role',
       'public.project_memberships',
       'UPDATE,DELETE,TRUNCATE'
     )
     or has_table_privilege(
       'service_role',
       'public.project_role_assignments',
       'UPDATE,DELETE,TRUNCATE'
     )
     or has_table_privilege(
       'service_role',
       'public.project_role_transfers',
       'UPDATE,DELETE,TRUNCATE'
     ) then
    raise exception 'R03D service-role destructive privilege remained';
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
    raise exception 'R03D removed a frozen legacy membership column';
  end if;
end;
$$;

select 'R03D_RUNTIME_SMOKE_PASSED' as result;

rollback;
