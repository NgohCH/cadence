# Identity Module

## Ownership

The Identity module owns stable Cadence Person identity and authentication
identity resolution.

VS002-01 formalises four distinct concepts:

```text
Cadence Person
!= Authentication Identity
!= Organisational Affiliation
!= Project Membership
```

Identity owns:

- the stable `CadencePerson` human identity;
- replaceable `AuthenticationIdentity` records;
- authentication-provider and provider-subject mapping concepts;
- authentication identity validity and enabled/disabled status;
- time-varying `INTERNAL`/`EXTERNAL` affiliation; and
- the boundary for explicit, trusted identity linking or relinking.

Identity does not own project membership, project roles, or project
permissions.

## Stable Person Identity

`CadencePerson.id` is the stable human reference. It is independent of email,
login identifier, authentication provider, provider account, affiliation, and
project participation.

Historical Cadence attribution must remain attached to this stable Person when
an authentication account is disabled or replaced.

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

The concept supports current local/Supabase authentication and future Entra or
external/B2B identities without putting provider-specific behaviour in the
domain model.

Authentication identity contains no project ID, membership, role, or
permission authority. Linking a replacement authentication identity to an
existing Person therefore cannot restore a historical project membership.

Cadence never merges identities automatically because names, email addresses,
or usernames look similar. Linking and relinking require an explicit trusted
operation. The application workflow and persistence for that operation are
deferred beyond VS002-01.

## Organisational Affiliation

Initial affiliation classifications are exactly:

```text
INTERNAL
EXTERNAL
```

Affiliation is a separate time-varying record and grants no project access or
authority. An `EXTERNAL` Person may hold `PROJECT_MANAGER` when separately
authorised through Project Membership.

No organisational hierarchy is introduced in VS002-01.

## VS-001 Compatibility Bridge

VS-001 continues to use `CadenceUser` as the current repository/API projection:

```text
Supabase Auth subject
  -> public.users.auth_user_id
  -> CadenceUser.id
  -> RequestContext.actorUserId
```

That flow, `GET /api/v1/me`, authentication failure behaviour, and existing
project authorization remain unchanged in VS002-01.

`CadenceUser` is retained explicitly as a compatibility projection because the
current `public.users` table combines identity and login-facing fields. VS002-02
will establish persistence mappings for stable Person and authentication
identity without casually rewriting the working VS-001 path.

## Boundary Rules

Authentication establishes who a Person is. Project Membership and Project
Authorisation establish what the Person may do in a Project.

The Identity module must not:

- infer project access from affiliation;
- infer Person equality from names, email addresses, or usernames;
- store project membership authority in authentication identities; or
- require Project Membership to understand a particular identity provider.

## Deliberately Deferred

VS002-01 does not add Person/authentication persistence, Entra-specific logic,
identity relinking APIs, invitation delivery, or project authorisation.
