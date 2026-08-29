\set ON_ERROR_STOP on

begin;


do $$
declare
  v_legacy_role_id uuid;
  v_outcome text;
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260828160000'
  ) then
    raise exception
      'R03A migration is not recorded locally';
  end if;


  insert into public.persons (
    id,
    display_name
  )
  values
    (
      'a03a0000-0000-4000-8000-000000000001',
      'R03A Actor'
    ),
    (
      'a03a0000-0000-4000-8000-000000000002',
      'R03A Administrative Member'
    ),
    (
      'a03a0000-0000-4000-8000-000000000003',
      'R03A Expiring Member'
    );


  insert into public.users (
    id,
    username,
    display_name,
    email,
    person_id
  )
  values (
    'a03a0000-0000-4000-8000-000000000001',
    'r03a_actor',
    'R03A Actor',
    'r03a_actor@example.test',
    'a03a0000-0000-4000-8000-000000000001'
  );


  insert into public.projects (
    id,
    name,
    owner_user_id
  )
  values (
    'a03a0000-0000-4000-8000-000000000010',
    'R03A Runtime Project',
    'a03a0000-0000-4000-8000-000000000001'
  );


  select role.id
  into v_legacy_role_id
  from public.roles as role
  where role.code = 'VIEWER';


  begin
    insert into public.project_memberships (
      id,
      project_id,
      user_id,
      role_id,
      status,
      joined_at,
      person_id,
      granted_by_person_id,
      created_at
    )
    values (
      'a03a0000-0000-4000-8000-000000000020',
      'a03a0000-0000-4000-8000-000000000010',
      'a03a0000-0000-4000-8000-000000000001',
      v_legacy_role_id,
      'active',
      '2026-08-01T00:00:00Z',
      'a03a0000-0000-4000-8000-000000000001',
      'a03a0000-0000-4000-8000-000000000001',
      '2026-08-01T00:00:00Z'
    );

    raise exception
      'R03A accepted a new legacy-shaped membership';
  exception
    when sqlstate '55000' then
      if sqlerrm <>
         'R03A_NEW_LEGACY_MEMBERSHIP_SHAPE_FORBIDDEN' then
        raise;
      end if;
  end;


  perform *
  from public.add_project_member(
    'a03a0000-0000-4000-8000-000000000021',
    'a03a0000-0000-4000-8000-000000000010',
    'a03a0000-0000-4000-8000-000000000002',
    '2026-08-01T00:00:00Z',
    null,
    'a03a0000-0000-4000-8000-000000000001',
    '2026-08-01T00:00:00Z',
    'a03a0000-0000-4000-8000-000000000031',
    'a03a0000-0000-4000-8000-000000000001',
    '2026-08-01T00:00:00Z',
    'a03a0000-0000-4000-8000-000000000041'
  );


  if not exists (
    select 1
    from public.project_memberships
    where id =
        'a03a0000-0000-4000-8000-000000000021'
      and user_id is null
      and role_id is null
      and status = 'active'
      and effective_from =
        '2026-08-01T00:00:00Z'::timestamptz
      and joined_at is distinct from effective_from
      and membership_status = 'ACTIVE'
  ) then
    raise exception
      'R03A canonical membership creation is invalid';
  end if;


  begin
    update public.project_memberships
    set user_id =
      'a03a0000-0000-4000-8000-000000000001'
    where id =
      'a03a0000-0000-4000-8000-000000000021';

    raise exception
      'R03A accepted a legacy identity rewrite';
  exception
    when sqlstate '55000' then
      if sqlerrm <>
         'R03A_LEGACY_MEMBERSHIP_HISTORY_IMMUTABLE' then
        raise;
      end if;
  end;


  begin
    update public.project_memberships
    set role_id = v_legacy_role_id
    where id =
      'a03a0000-0000-4000-8000-000000000021';

    raise exception
      'R03A accepted a legacy role rewrite';
  exception
    when sqlstate '55000' then
      if sqlerrm <>
         'R03A_LEGACY_MEMBERSHIP_HISTORY_IMMUTABLE' then
        raise;
      end if;
  end;


  begin
    update public.project_memberships
    set joined_at =
      '2026-07-01T00:00:00Z'
    where id =
      'a03a0000-0000-4000-8000-000000000021';

    raise exception
      'R03A accepted a legacy start rewrite';
  exception
    when sqlstate '55000' then
      if sqlerrm <>
         'R03A_LEGACY_MEMBERSHIP_HISTORY_IMMUTABLE' then
        raise;
      end if;
  end;


  begin
    update public.project_memberships
    set created_by =
      'a03a0000-0000-4000-8000-000000000001'
    where id =
      'a03a0000-0000-4000-8000-000000000021';

    raise exception
      'R03A accepted a legacy grantor rewrite';
  exception
    when sqlstate '55000' then
      if sqlerrm <>
         'R03A_LEGACY_MEMBERSHIP_HISTORY_IMMUTABLE' then
        raise;
      end if;
  end;


  begin
    update public.project_memberships
    set status = 'inactive'
    where id =
      'a03a0000-0000-4000-8000-000000000021';

    raise exception
      'R03B accepted a retired lifecycle-source rewrite';
  exception
    when sqlstate '55000' then
      if sqlerrm <>
         'R03A_LEGACY_MEMBERSHIP_HISTORY_IMMUTABLE' then
        raise;
      end if;
  end;


  select result.lifecycle_outcome
  into v_outcome
  from public.terminate_project_membership(
    'a03a0000-0000-4000-8000-000000000010',
    'a03a0000-0000-4000-8000-000000000021',
    '2026-08-05T00:00:00Z',
    'a03a0000-0000-4000-8000-000000000001',
    'R03A administrative lifecycle proof',
    'a03a0000-0000-4000-8000-000000000042'
  ) as result;


  if v_outcome <> 'ENDED'
     or not exists (
       select 1
       from public.project_memberships
       where id =
           'a03a0000-0000-4000-8000-000000000021'
         and status = 'active'
         and membership_status = 'ENDED'
         and effective_from =
           '2026-08-01T00:00:00Z'::timestamptz
         and joined_at is distinct from effective_from
         and user_id is null
         and role_id is null
     ) then
    raise exception
      'R03A administrative lifecycle compatibility failed';
  end if;


  perform *
  from public.add_project_member(
    'a03a0000-0000-4000-8000-000000000022',
    'a03a0000-0000-4000-8000-000000000010',
    'a03a0000-0000-4000-8000-000000000003',
    '2026-08-01T00:00:00Z',
    '2026-08-03T00:00:00Z',
    'a03a0000-0000-4000-8000-000000000001',
    '2026-08-01T00:00:00Z',
    'a03a0000-0000-4000-8000-000000000032',
    'a03a0000-0000-4000-8000-000000000001',
    '2026-08-01T00:00:00Z',
    'a03a0000-0000-4000-8000-000000000043'
  );


  select result.lifecycle_outcome
  into v_outcome
  from public.finalize_project_membership_expiry(
    'a03a0000-0000-4000-8000-000000000010',
    'a03a0000-0000-4000-8000-000000000022',
    '2026-08-04T00:00:00Z',
    'R03A expiry lifecycle proof',
    'a03a0000-0000-4000-8000-000000000044'
  ) as result;


  if v_outcome <> 'ENDED'
     or not exists (
       select 1
       from public.project_memberships
       where id =
           'a03a0000-0000-4000-8000-000000000022'
         and status = 'active'
         and membership_status = 'ENDED'
         and effective_to =
           '2026-08-03T00:00:00Z'::timestamptz
         and termination_kind = 'EXPIRY'
         and user_id is null
         and role_id is null
     ) then
    raise exception
      'R03A expiry lifecycle compatibility failed';
  end if;
end;
$$;


rollback;

select 'R03A_RUNTIME_SMOKE_PASSED' as result;
