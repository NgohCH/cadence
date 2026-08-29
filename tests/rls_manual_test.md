# RLS manual test checklist

Use two authenticated Supabase test users linked to two `public.users` rows.

1. Create Project A and add User A as an active project member.
2. Create Project B and add only User B as a member.
3. With User A JWT, confirm Project A is readable and Project B is not returned.
4. Confirm User A cannot directly INSERT/UPDATE/DELETE project tables through the browser client.
5. Confirm User A can read messages, tasks, topics, decisions, blockers, milestones, and files only in projects where User A is an active member.
6. Confirm a Viewer can read project state but the server API rejects write commands based on RBAC.
7. Confirm `audit_events` is only readable when the project role carries `audit.view`.
8. Confirm `domain_events`, `idempotency_keys`, and `ai_prompt_versions` are not directly readable by authenticated browser clients.
9. Confirm the service-role key is used server-side only and is never exposed to the browser.
10. Confirm authenticated and anonymous Data API clients cannot directly read
    `persons`, `authentication_identities`, `organisational_affiliations`, or
    `project_role_assignments` during VS002-02.
11. Confirm the server-side service-role client can persist and read the new
    Identity and Project Membership records.
12. Confirm the existing authenticated project read matrix still succeeds
    through the legacy `public.project_memberships.user_id`/`role_id` bridge.
13. As an authenticated VS-001 project member, confirm a direct select of
    `public.project_memberships` can return rows only when both `user_id` and
    `role_id` are non-null.
14. Confirm the same authenticated client cannot directly select a new
    Person-only membership row whose `user_id` and `role_id` are null, even
    when that row belongs to a project the client can otherwise read.
15. Confirm the service-role repository can still read the Person-only row.

Items 13-15 verify only the temporary VS-001 compatibility policy. VS002-03
remains responsible for the eventual Project Authorisation read model.
