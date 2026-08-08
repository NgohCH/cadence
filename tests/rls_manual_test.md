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
