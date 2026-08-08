-- Cadence v0.1
-- Migration: Row Level Security baseline
-- Design choice: authenticated browser clients receive SELECT access only.
-- All mutations are routed through the Cadence API/module layer on the server.

-- Explicit grants.
grant usage on schema public to authenticated, service_role;
grant select on public.users,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.platform_role_assignments,
  public.projects,
  public.project_memberships,
  public.messages,
  public.message_versions,
  public.message_mentions,
  public.message_reactions,
  public.topics,
  public.decisions,
  public.decision_supersedes,
  public.tasks,
  public.blockers,
  public.milestones,
  public.files,
  public.file_links,
  public.entity_links,
  public.source_links,
  public.ai_proposals,
  public.alerts,
  public.notifications,
  public.audit_events,
  public.project_health,
  public.project_health_history
  to authenticated;

grant select on public.current_messages to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Tables that are intentionally internal-only to server-side processing are not
-- granted to authenticated clients: ai_prompt_versions, ai_runs, idempotency_keys,
-- domain_events. AI run metadata/raw payloads are exposed only through the server API.

alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.platform_role_assignments enable row level security;
alter table public.projects enable row level security;
alter table public.project_memberships enable row level security;
alter table public.messages enable row level security;
alter table public.message_versions enable row level security;
alter table public.message_mentions enable row level security;
alter table public.message_reactions enable row level security;
alter table public.topics enable row level security;
alter table public.decisions enable row level security;
alter table public.decision_supersedes enable row level security;
alter table public.tasks enable row level security;
alter table public.blockers enable row level security;
alter table public.milestones enable row level security;
alter table public.files enable row level security;
alter table public.file_links enable row level security;
alter table public.entity_links enable row level security;
alter table public.source_links enable row level security;
alter table public.ai_prompt_versions enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_proposals enable row level security;
alter table public.alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.domain_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.project_health enable row level security;
alter table public.project_health_history enable row level security;

create policy users_select_visible
on public.users for select to authenticated
using ((select public.can_view_user(id)));

create policy roles_select_authenticated
on public.roles for select to authenticated
using (true);

create policy permissions_select_authenticated
on public.permissions for select to authenticated
using (true);

create policy role_permissions_select_authenticated
on public.role_permissions for select to authenticated
using (true);

create policy platform_role_assignments_select_self
on public.platform_role_assignments for select to authenticated
using (user_id = (select public.current_app_user_id()));

create policy projects_select_member
on public.projects for select to authenticated
using ((select public.is_project_member(id)));

create policy memberships_select_project_member
on public.project_memberships for select to authenticated
using ((select public.is_project_member(project_id)));

create policy messages_select_project_member
on public.messages for select to authenticated
using ((select public.is_project_member(project_id)));

create policy message_versions_select_project_member
on public.message_versions for select to authenticated
using ((select public.can_access_message(message_id)));

create policy message_mentions_select_project_member
on public.message_mentions for select to authenticated
using ((select public.can_access_message(message_id)));

create policy message_reactions_select_project_member
on public.message_reactions for select to authenticated
using ((select public.can_access_message(message_id)));

create policy topics_select_project_member
on public.topics for select to authenticated
using ((select public.is_project_member(project_id)));

create policy decisions_select_project_member
on public.decisions for select to authenticated
using ((select public.is_project_member(project_id)));

create policy decision_supersedes_select_project_member
on public.decision_supersedes for select to authenticated
using ((select public.can_access_decision(new_decision_id)));

create policy tasks_select_project_member
on public.tasks for select to authenticated
using ((select public.is_project_member(project_id)));

create policy blockers_select_project_member
on public.blockers for select to authenticated
using ((select public.is_project_member(project_id)));

create policy milestones_select_project_member
on public.milestones for select to authenticated
using ((select public.is_project_member(project_id)));

create policy files_select_project_member
on public.files for select to authenticated
using ((select public.is_project_member(project_id)));

create policy file_links_select_project_member
on public.file_links for select to authenticated
using ((select public.can_access_file(file_id)));

create policy entity_links_select_project_member
on public.entity_links for select to authenticated
using ((select public.is_project_member(project_id)));

create policy source_links_select_project_member
on public.source_links for select to authenticated
using ((select public.is_project_member(project_id)));


create policy ai_proposals_select_agent_users
on public.ai_proposals for select to authenticated
using (
  (select public.has_project_permission(project_id, 'agent.use'))
  or (select public.has_project_permission(project_id, 'audit.view'))
);

create policy alerts_select_visible
on public.alerts for select to authenticated
using (
  (user_id = (select public.current_app_user_id()))
  or (user_id is null and (select public.is_project_member(project_id)))
);

create policy notifications_select_self
on public.notifications for select to authenticated
using (user_id = (select public.current_app_user_id()));

create policy audit_events_select_authorized
on public.audit_events for select to authenticated
using (
  project_id is not null
  and (select public.has_project_permission(project_id, 'audit.view'))
);

create policy project_health_select_member
on public.project_health for select to authenticated
using ((select public.is_project_member(project_id)));

create policy project_health_history_select_member
on public.project_health_history for select to authenticated
using ((select public.is_project_member(project_id)));
