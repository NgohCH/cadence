# RBAC Module

## Ownership

The RBAC module owns Cadence authorization decisions.

This includes:

- project roles,
- permissions,
- role-to-permission relationships,
- project membership authorization,
- permission checks for protected operations.

The RBAC module answers:

> Is this authenticated Cadence user allowed to perform this operation in this project?

---

## Authentication vs Authorization

RBAC does not authenticate users.

Authentication is completed before RBAC is invoked.

Current request flow:

```text
Supabase Auth
  ->
Cadence Identity
  ->
RequestContext
  ->
RBAC
```

Authentication establishes:

```text
Who is this user?
```

RBAC establishes:

```text
What may this user do in this project?
```

An authenticated user is not automatically authorized to access every Cadence project.

---

## Authoritative Actor

Protected operations must use the authenticated Cadence user from:

```text
RequestContext.actorUserId
```

The RBAC module must not trust a user ID supplied by the browser or API request body as the acting user.

The authenticated actor from `RequestContext` is authoritative.

---

## Project Authorization Model

Cadence project authorization currently follows:

```text
Cadence user
  +
project
  ->
active project membership
  ->
project role
  ->
role permissions
  ->
permission code
```

The current database relationships are:

```text
project_memberships
  ->
roles
  ->
role_permissions
  ->
permissions
```

The Supabase RBAC repository resolves these relationships and returns project access to the application layer.

---

## Project Access Model

The current RBAC project-access result contains:

```text
membershipId
projectId
userId
roleId
roleCode
permissions[]
```

Conceptually:

```typescript
export interface ProjectAccess {
  membershipId: string;
  projectId: string;
  userId: string;
  roleId: string;
  roleCode: string;
  permissions: string[];
}
```

Only active project memberships qualify for project access.

---

## Current Components

The RBAC module currently includes:

```text
rbac.types.ts
rbac.repository.ts
rbac.service.ts
README.md
```

The Supabase infrastructure implementation is:

```text
apps/api/src/infrastructure/database/supabase-rbac.repository.ts
```

The module-level repository contract remains independent of Supabase.

---

## Repository Contract

The current repository contract provides:

```typescript
getProjectAccess(
  userId: string,
  projectId: string
): Promise<ProjectAccess | null>
```

A `null` result means no qualifying active membership was found.

The repository resolves:

```text
membership
role
permissions
```

It does not decide how a business module exposes authorization failure through HTTP.

---

## RBAC Service

The current RBAC service provides:

```text
getProjectAccess(...)
hasPermission(...)
```

`getProjectAccess(...)` returns resolved membership, role, and permission information.

`hasPermission(...)` checks whether the required permission code exists in the resolved permission set.

Example:

```typescript
await rbacService.hasPermission(
  userId,
  projectId,
  "project.view"
);
```

Business modules may use the richer project-access result when they need to distinguish:

```text
no membership
```

from:

```text
membership exists but permission is missing
```

---

## Permission Codes

Cadence authorization is based on permission codes.

Example:

```text
project.view
```

Business modules must not hard-code authorization around role names such as:

```text
PROJECT_LEAD
VIEWER
```

Do not write:

```typescript
if (roleCode === "PROJECT_LEAD") {
  // allow
}
```

Instead, check the required permission:

```typescript
if (
  access.permissions.includes("project.view")
) {
  // allow
}
```

This allows role definitions to change without requiring endpoint code to change.

---

# VS001-03 Project Workspace Authorization

VS001-03 introduced project-scoped RBAC into the live API request path.

Protected endpoint:

```text
GET /api/v1/projects/{projectId}/summary
```

Required permission:

```text
project.view
```

Current authorization order:

```text
authenticated Cadence user
  ->
resolve active project membership
  ->
resolve role
  ->
resolve permissions
  ->
check project.view
  ->
load Project Workspace summary
```

Project Workspace data is not returned until membership and permission checks succeed.

---

## No Active Membership

If the authenticated user has no active membership in the requested project:

```text
404 NOT_FOUND
```

is returned.

This is intentional.

It avoids confirming the existence of a protected project to someone who is not a member.

Example:

```text
Alice requests Bob Project
  ->
no qualifying Alice membership
  ->
404 NOT_FOUND
```

Possession or guessing of a project UUID does not grant access.

---

## Active Membership Without Permission

If the authenticated user has an active project membership but does not have:

```text
project.view
```

the result is:

```text
403 PERMISSION_DENIED
```

This distinguishes a known project member who lacks permission from a user who has no qualifying membership.

---

# VS001-03 Manual Verification

The complete Project Workspace authorization matrix has been manually verified.

## No JWT

Result:

```text
401 UNAUTHENTICATED
```

Passed.

## Valid Member With `project.view`

Alice requested Alice Project with:

```text
active membership
+
PROJECT_LEAD role
+
project.view
```

Result:

```text
200 OK
```

Passed.

## Authenticated User Without Membership

Alice requested Bob Project.

Result:

```text
404 NOT_FOUND
```

Passed.

## Active Member Without `project.view`

Bob was already an active member of Alice Project using the normal:

```text
VIEWER
```

role.

The normal `VIEWER` role includes:

```text
project.view
```

The normal role was not modified.

A temporary project-scoped role was created:

```text
TEST_NO_PROJECT_VIEW
```

with no permissions.

Bob's Alice Project membership was temporarily assigned to that role.

Result:

```text
403 PERMISSION_DENIED
```

Passed.

After the test:

- Bob's original `VIEWER` role was restored.
- `TEST_NO_PROJECT_VIEW` was deleted.
- normal system-role permissions remained unchanged.

## Unknown Project UUID

A valid Alice JWT was used against an unknown project UUID.

Result:

```text
404 NOT_FOUND
```

Passed.

---

## Verified `VIEWER` Permissions

During VS001-03 testing, the `VIEWER` role was confirmed to contain:

```text
activity.view
alert.view
blocker.view
decision.view
file.view
member.view
message.view
milestone.view
notification.view
project_health.view
project.view
task.view
topic.view
```

Because `VIEWER` includes `project.view`, it must not be weakened merely to create a negative authorization test.

Use isolated test fixtures instead.

---

# Boundary Rules

RBAC owns authorization interpretation.

Business modules must not independently invent role logic.

The following rules apply:

1. Authentication must be complete before RBAC runs.
2. Authentication success does not imply project authorization.
3. Project membership must be resolved server-side.
4. Only active memberships qualify for project access.
5. Permission codes are the authorization primitive.
6. Role names must not be hard-coded as endpoint permissions.
7. Client-supplied project IDs must not be trusted without authorization checks.
8. Client-supplied user IDs must not replace `RequestContext.actorUserId`.
9. Business modules may distinguish no-membership from permission-denied where appropriate.
10. Normal seeded roles should not be weakened merely to create negative tests.
11. Temporary authorization fixtures must be isolated and cleaned up after testing.
12. RBAC does not own business-module persistence.
13. RBAC does not authenticate JWTs.
14. Human confirmation does not bypass RBAC.
15. Team Agent operations do not bypass RBAC.

---

## Module Boundary Example

For Project Workspace:

```text
ProjectsService
  ->
RbacService.getProjectAccess()
  ->
require active membership
  ->
require project.view
  ->
ProjectWorkspaceReadRepository
```

For future protected writes:

```text
authenticated actor
  ->
project membership
  ->
required permission
  ->
owning module service
  ->
authoritative write
```

RBAC determines whether an operation is allowed.

The owning business module remains responsible for its own business rules and persistence.

---

# Future Testing

VS001-03 RBAC behaviour has been manually verified.

Automated regression coverage should later include:

```text
authorized member + required permission
  ->
allow
```

```text
no active membership
  ->
deny
```

```text
active membership + missing permission
  ->
deny
```

```text
unrelated project UUID
  ->
no cross-project access
```

Automated fixtures should be isolated and repeatable.

They must not permanently weaken normal role definitions.

---

# Handoff Rule

When introducing a new protected Cadence operation:

1. identify the owning business module,
2. identify the required permission code,
3. obtain the acting user from `RequestContext`,
4. resolve project access through RBAC,
5. distinguish membership and permission failure where required,
6. enforce authorization before accessing protected state,
7. test successful and denied paths,
8. document new permission or authorization behaviour,
9. update `CHANGELOG.md` and `HANDOFF.md` for material changes.

Authorization logic should remain explicit, predictable, and easy for another engineer to trace.