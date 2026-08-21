# Identity Module

## Ownership

Identity owns stable Cadence Person identity, replaceable authentication
identities, and time-varying organisational affiliation. It does not own
project membership, project roles, or project permissions.

The frozen concepts remain distinct:

```text
Cadence Person
!= Authentication Identity
!= Organisational Affiliation
!= Project Membership
```

## Stable Person Identity

`CadencePerson.id` is the stable human reference. It is independent of email,
username, login identifier, authentication provider, provider account,
affiliation, and project participation.

Stable people are stored in `public.persons`. The table contains the Person ID,
display name, and row timestamps. Historical attribution remains attached to
that Person when an authentication account is disabled or replaced.

## Authentication Identity

`AuthenticationIdentity` associates a stable `personId` with provider-neutral
authentication data:

```text
provider
providerSubjectId
loginIdentifier
validFrom
validTo
status
```

Authentication identities are stored in `public.authentication_identities`.
`(provider, provider_subject_id)` is unique, bounded validity intervals must
have an end later than their start, and status is exactly `ACTIVE` or
`DISABLED`. Multiple authentication identities may reference the same Person
over time without changing Person identity.

Login identifiers are mutable authentication data, not Person keys. An
authentication identity contains no project ID, membership, role, permission,
or access authority. Adding or replacing one therefore cannot recreate a
historical project membership.

Cadence never merges identities because names, email addresses, or usernames
look similar. Linking/relinking requires an explicit trusted operation.
VS002-02 supplies independent persistence records but does not implement that
workflow or any provider-specific Entra behaviour.

## Organisational Affiliation

Affiliations are stored independently in
`public.organisational_affiliations`. They use the exact `INTERNAL`/`EXTERNAL`
vocabulary and optional positive validity intervals.

Affiliation grants no project access and does not restrict project roles. In
particular, an `EXTERNAL` Person may hold `PROJECT_MANAGER` through a separate
Project Membership role assignment. The migration creates no affiliation rows
for VS-001 users because VS-001 has no safe affiliation source. No
organisational hierarchy is introduced.

## Persistence Contract

`IdentityPersistenceRepository` provides only foundational create/read
operations for Person, Authentication Identity, and Organisational
Affiliation. Its Supabase adapter is:

```text
apps/api/src/infrastructure/database/
  supabase-identity-persistence.repository.ts
```

This contract is separate from the working VS-001
`IdentityRepository.findByAuthSubject(...)` authentication-resolution path.

## VS-001 Compatibility Bridge

VS-001 continues to use `CadenceUser`:

```text
Supabase Auth subject
  -> public.users.auth_user_id
  -> CadenceUser.id
  -> RequestContext.actorUserId
```

`GET /api/v1/me`, authentication failure behaviour, actor IDs, historical user
FKs, and current project authorization remain unchanged.

The migration adds this deterministic bridge:

```text
public.users.id
  = initial public.persons.id

public.users.person_id
  -> public.persons.id
```

The mapping uses existing primary keys, not display name, username, or email.
`users.person_id` is not unique so a later trusted relinking process can map a
replacement compatibility identity to the same Person.

For an existing row with `auth_user_id`, the migration uses the exact working
relationship: `identity_provider` plus `auth_user_id` as provider subject.
Email is copied only as the mutable login identifier. Rows without an explicit
authentication subject are not guessed or linked. `users.created_at` supplies
the start of the Cadence authentication mapping. Disabled rows keep
`status = DISABLED` with a null `valid_to` because VS-001 has no dedicated,
reliable authentication-disable timestamp.

The same no-fabrication rule applies when Project Membership resolves the
nullable VS-001 `created_by` reference to a Person. A missing historical
grantor remains null; Identity does not create a system Person or infer a
substitute identity to fill unavailable provenance.

## Security

The new Identity tables have RLS enabled and no anonymous or authenticated
browser grants in VS002-02. The server-side service-role adapter has explicit
table privileges. This prevents direct browser exposure of provider subjects
and login identifiers while later query and authorization flows are deferred.

## Boundary Rules

Authentication establishes who a Person is. Project Membership and Project
Authorisation establish what the Person may do in a Project.

Identity must not:

- infer project access from affiliation;
- infer Person equality from names, email addresses, or usernames;
- store project authority in authentication identities; or
- require Project Membership to understand an authentication provider.

## Deliberately Deferred

VS002-02 does not add identity relinking APIs, automatic matching, Entra/B2B
integration, invitation delivery, member routes, or project authorisation.
