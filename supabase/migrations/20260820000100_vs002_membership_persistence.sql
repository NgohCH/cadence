-- Cadence VS002-02
-- Migration: stable Person, authentication identity, affiliation, membership,
-- and project-role-assignment persistence.
--
-- VS-001 compatibility is deliberate:
--   * public.users remains the authenticated CadenceUser projection;
--   * existing user IDs become the initial stable Person IDs;
--   * public.project_memberships keeps its user_id, role_id, status, and
--     joined_at columns for the existing RBAC path; and
--   * no legacy role code is reinterpreted as a frozen VS-002 project role.

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint persons_display_name_not_blank
    check (btrim(display_name) <> '')
);

insert into public.persons (
  id,
  display_name,
  created_at,
  updated_at
)
select
  u.id,
  u.display_name,
  u.created_at,
  u.updated_at
from public.users u;

alter table public.users
  add column person_id uuid;

update public.users
set person_id = id;

alter table public.users
  alter column person_id set not null,
  add constraint users_person_id_fkey
    foreign key (person_id)
    references public.persons(id)
    on delete restrict,
  add constraint users_id_person_key
    unique (id, person_id);

create index users_person_id_idx
  on public.users(person_id);

create table public.authentication_identities (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null
    references public.persons(id) on delete restrict,
  provider text not null,
  provider_subject_id text not null,
  login_identifier text not null,
  valid_from timestamptz not null,
  valid_to timestamptz,
  status text not null
    check (status in ('ACTIVE', 'DISABLED')),
  created_at timestamptz not null default now(),
  constraint authentication_identities_provider_not_blank
    check (btrim(provider) <> ''),
  constraint authentication_identities_subject_not_blank
    check (btrim(provider_subject_id) <> ''),
  constraint authentication_identities_login_not_blank
    check (btrim(login_identifier) <> ''),
  constraint authentication_identities_valid_period
    check (valid_to is null or valid_to > valid_from),
  constraint authentication_identities_provider_subject_key
    unique (provider, provider_subject_id)
);

-- auth_user_id is the exact provider subject used by the working VS-001
-- authentication path. The mapping does not compare names, usernames, or
-- emails. Email is copied only as mutable login data, never as Person identity.
insert into public.authentication_identities (
  id,
  person_id,
  provider,
  provider_subject_id,
  login_identifier,
  valid_from,
  valid_to,
  status,
  created_at
)
select
  u.auth_user_id,
  u.person_id,
  u.identity_provider,
  u.auth_user_id::text,
  u.email::text,
  u.created_at,
  null,
  case u.status
    when 'active' then 'ACTIVE'
    else 'DISABLED'
  end,
  u.created_at
from public.users u
where u.auth_user_id is not null;

create index authentication_identities_person_validity_idx
  on public.authentication_identities(person_id, status, valid_from, valid_to);

create table public.organisational_affiliations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null
    references public.persons(id) on delete restrict,
  classification text not null
    check (classification in ('INTERNAL', 'EXTERNAL')),
  organisation_name text,
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  constraint organisational_affiliations_organisation_not_blank
    check (organisation_name is null or btrim(organisation_name) <> ''),
  constraint organisational_affiliations_effective_period
    check (effective_to is null or effective_to > effective_from)
);

create index organisational_affiliations_person_period_idx
  on public.organisational_affiliations(
    person_id,
    effective_from,
    effective_to
  );

-- Evolve the existing VS-001 table instead of creating a second membership
-- authority. Compatibility columns remain available to the current RBAC path.
alter table public.project_memberships
  drop constraint project_memberships_project_id_user_id_key,
  alter column user_id drop not null,
  alter column role_id drop not null,
  add column person_id uuid,
  add column effective_from timestamptz
    generated always as (joined_at) stored,
  add column effective_to timestamptz,
  add column membership_status text
    generated always as (
      case status
        when 'active' then 'ACTIVE'
        when 'inactive' then 'ENDED'
      end
    ) stored,
  add column granted_by_person_id uuid,
  add column created_at timestamptz,
  add column termination_reason text;

update public.project_memberships pm
set
  person_id = u.person_id,
  effective_to = case
    when pm.status = 'inactive' then
      greatest(
        pm.updated_at,
        pm.joined_at + interval '1 microsecond'
      )
    else null
  end,
  granted_by_person_id = (
    select grantor.person_id
    from public.users grantor
    where grantor.id = pm.created_by
  ),
  created_at = pm.joined_at
from public.users u
where u.id = pm.user_id;

-- A null grantor on a VS-001 compatibility row truthfully means that the
-- historical created_by provenance was unavailable. It must not be replaced
-- with the member, an administrator, or a fabricated system Person.

-- The VS-001 role-scope trigger originally assumed role_id was mandatory.
-- New VS-002 memberships may exist before a separate role assignment is
-- persisted, while legacy memberships continue to validate their role_id.
create or replace function public.enforce_project_role_scope()
returns trigger
language plpgsql
as $$
begin
  if new.role_id is not null and not exists (
    select 1 from public.roles r
    where r.id = new.role_id and r.scope = 'project'
  ) then
    raise exception 'role_id must reference a project-scoped role'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

alter table public.project_memberships
  alter column person_id set not null,
  alter column created_at set not null,
  alter column created_at set default now(),
  add constraint project_memberships_person_id_fkey
    foreign key (person_id)
    references public.persons(id)
    on delete restrict,
  add constraint project_memberships_compatibility_user_person_fkey
    foreign key (user_id, person_id)
    references public.users(id, person_id)
    on delete restrict,
  add constraint project_memberships_granted_by_person_id_fkey
    foreign key (granted_by_person_id)
    references public.persons(id)
    on delete restrict,
  add constraint project_memberships_effective_period
    check (effective_to is null or effective_to > effective_from),
  add constraint project_memberships_ended_period
    check (membership_status <> 'ENDED' or effective_to is not null),
  add constraint project_memberships_termination_reason_not_blank
    check (termination_reason is null or btrim(termination_reason) <> ''),
  add constraint project_memberships_compatibility_access_shape
    check (
      (user_id is null and role_id is null)
      or (user_id is not null and role_id is not null)
    ),
  add constraint project_memberships_person_only_grantor_required
    check (
      user_id is not null
      or granted_by_person_id is not null
    ),
  add constraint project_memberships_id_project_key
    unique (id, project_id);

-- Preserve the cardinality assumed by SupabaseRbacRepository.maybeSingle()
-- while allowing multiple historical memberships after earlier rows end.
create unique index project_memberships_active_user_project_uidx
  on public.project_memberships(project_id, user_id)
  where user_id is not null and status = 'active';

create index project_memberships_person_status_idx
  on public.project_memberships(person_id, membership_status);

create index project_memberships_project_person_period_idx
  on public.project_memberships(
    project_id,
    person_id,
    effective_from,
    effective_to
  );

create table public.project_role_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  membership_id uuid not null,
  role text not null
    check (role in (
      'PROJECT_SPONSOR',
      'PROJECT_OWNER',
      'PROJECT_MANAGER',
      'PROJECT_MEMBER',
      'PROJECT_OBSERVER',
      'PROJECT_AUDITOR'
    )),
  effective_from timestamptz not null,
  effective_to timestamptz,
  assigned_by_person_id uuid not null
    references public.persons(id) on delete restrict,
  change_reason text,
  created_at timestamptz not null default now(),
  constraint project_role_assignments_membership_project_fkey
    foreign key (membership_id, project_id)
    references public.project_memberships(id, project_id)
    on delete restrict,
  constraint project_role_assignments_effective_period
    check (effective_to is null or effective_to > effective_from),
  constraint project_role_assignments_change_reason_not_blank
    check (change_reason is null or btrim(change_reason) <> '')
);

create index project_role_assignments_membership_period_idx
  on public.project_role_assignments(
    membership_id,
    effective_from,
    effective_to
  );

create index project_role_assignments_project_role_period_idx
  on public.project_role_assignments(
    project_id,
    role,
    effective_from,
    effective_to
  );

create trigger persons_touch_updated_at
before update on public.persons
for each row execute function public.touch_updated_at();

create trigger persons_prevent_hard_delete
before delete on public.persons
for each row execute function public.prevent_hard_delete();

create trigger authentication_identities_prevent_hard_delete
before delete on public.authentication_identities
for each row execute function public.prevent_hard_delete();

create trigger organisational_affiliations_prevent_hard_delete
before delete on public.organisational_affiliations
for each row execute function public.prevent_hard_delete();

create trigger project_memberships_prevent_hard_delete
before delete on public.project_memberships
for each row execute function public.prevent_hard_delete();

create trigger project_role_assignments_prevent_hard_delete
before delete on public.project_role_assignments
for each row execute function public.prevent_hard_delete();

-- These tables are server-side persistence foundations in VS002-02. No
-- authenticated browser policy is added before the later member APIs and
-- Project Authorisation boundary exist.
alter table public.persons enable row level security;
alter table public.authentication_identities enable row level security;
alter table public.organisational_affiliations enable row level security;
alter table public.project_role_assignments enable row level security;

-- The VS-001 authenticated policy predates Person-only memberships. Keep its
-- compatibility path limited to rows that retain the complete VS-001 access
-- shape until VS002-03 introduces the Project Authorisation boundary.
drop policy memberships_select_project_member
on public.project_memberships;

create policy memberships_select_project_member
on public.project_memberships for select to authenticated
using (
  user_id is not null
  and role_id is not null
  and (select public.is_project_member(project_id))
);

revoke all on table public.persons from anon, authenticated;
revoke all on table public.authentication_identities from anon, authenticated;
revoke all on table public.organisational_affiliations from anon, authenticated;
revoke all on table public.project_role_assignments from anon, authenticated;

grant select, insert, update, delete on table
  public.persons,
  public.authentication_identities,
  public.organisational_affiliations,
  public.project_role_assignments
to service_role;

comment on column public.users.person_id is
  'VS-001 CadenceUser to stable Cadence Person compatibility bridge.';

comment on column public.project_memberships.user_id is
  'Nullable VS-001 RBAC compatibility reference; stable membership identity uses person_id.';

comment on column public.project_memberships.role_id is
  'Nullable VS-001 RBAC compatibility role; VS-002 role history uses project_role_assignments.';

comment on column public.project_memberships.membership_status is
  'Frozen VS-002 lifecycle projection generated from the VS-001 compatibility status column.';

comment on column public.project_memberships.granted_by_person_id is
  'Stable Person grantor. NULL is permitted only for VS-001 compatibility rows whose historical created_by provenance was unavailable; new Person-only memberships require a grantor.';
