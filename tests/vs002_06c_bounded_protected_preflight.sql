\set ON_ERROR_STOP on

-- Read-only VS002-06C deployment preflight. Any returned row is an existing
-- Owner/Manager assignment whose membership expires automatically. Resolve
-- continuity through normal business operations before applying VS002-06C.
select
  membership.project_id,
  membership.id as membership_id,
  assignment.id as assignment_id,
  assignment.role,
  membership.effective_to
from public.project_memberships as membership
join public.project_role_assignments as assignment
  on assignment.membership_id = membership.id
 and assignment.project_id = membership.project_id
where membership.membership_status = 'ACTIVE'
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

do $$
begin
  if exists (
    select 1
    from public.project_memberships as membership
    join public.project_role_assignments as assignment
      on assignment.membership_id = membership.id
     and assignment.project_id = membership.project_id
    where membership.membership_status = 'ACTIVE'
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
  ) then
    raise exception
      'VS002_06C_BOUNDED_PROTECTED_ROLE_VIOLATIONS';
  end if;
end;
$$;
