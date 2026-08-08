-- Cadence v0.1
-- Migration: indexes for project access, RLS, timelines, and search

create index users_auth_user_id_idx on public.users(auth_user_id);
create index project_memberships_user_status_idx on public.project_memberships(user_id, status);
create index project_memberships_project_status_idx on public.project_memberships(project_id, status);
create index platform_role_assignments_user_idx on public.platform_role_assignments(user_id);
create index role_permissions_permission_idx on public.role_permissions(permission_id);

create index projects_owner_idx on public.projects(owner_user_id);
create index messages_project_created_idx on public.messages(project_id, created_at desc);
create index messages_thread_parent_idx on public.messages(thread_parent_id) where thread_parent_id is not null;
create index message_versions_message_version_idx on public.message_versions(message_id, version_number desc);
create index message_mentions_user_idx on public.message_mentions(mentioned_user_id);
create index message_reactions_message_idx on public.message_reactions(message_id);

create index topics_project_status_idx on public.topics(project_id, status);
create index decisions_project_status_idx on public.decisions(project_id, status);
create index tasks_project_status_idx on public.tasks(project_id, status);
create index tasks_assigned_status_idx on public.tasks(assigned_to, status);
create index tasks_due_date_idx on public.tasks(due_date) where due_date is not null;
create index blockers_project_status_idx on public.blockers(project_id, status);
create index blockers_project_severity_idx on public.blockers(project_id, severity) where status <> 'resolved';
create index milestones_project_target_idx on public.milestones(project_id, target_date);
create index files_project_created_idx on public.files(project_id, created_at desc);

create index entity_links_project_idx on public.entity_links(project_id);
create index entity_links_source_idx on public.entity_links(source_type, source_id);
create index entity_links_target_idx on public.entity_links(target_type, target_id);
create index source_links_project_idx on public.source_links(project_id);
create index source_links_entity_idx on public.source_links(entity_type, entity_id);
create index source_links_source_idx on public.source_links(source_type, source_id);

create index ai_runs_project_started_idx on public.ai_runs(project_id, started_at desc);
create index ai_runs_correlation_idx on public.ai_runs(correlation_id);
create index ai_proposals_project_status_idx on public.ai_proposals(project_id, status);
create index notifications_user_read_idx on public.notifications(user_id, read_at, created_at desc);
create index alerts_project_active_idx on public.alerts(project_id, starts_at, expires_at);

create index idempotency_keys_expiry_idx on public.idempotency_keys(expires_at) where expires_at is not null;
create index domain_events_pending_idx on public.domain_events(status, available_at, occurred_at);
create index domain_events_project_idx on public.domain_events(project_id, occurred_at desc);
create index domain_events_correlation_idx on public.domain_events(correlation_id);
create index audit_events_project_created_idx on public.audit_events(project_id, created_at desc);
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id, created_at desc);
create index audit_events_correlation_idx on public.audit_events(correlation_id, created_at);
create index project_health_history_project_idx on public.project_health_history(project_id, created_at desc);

-- PostgreSQL full-text search baseline for v0.1.
create index message_versions_fts_idx
  on public.message_versions using gin (to_tsvector('simple', content));
create index topics_fts_idx
  on public.topics using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '')));
create index decisions_fts_idx
  on public.decisions using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(rationale, '')));
create index tasks_fts_idx
  on public.tasks using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));
create index blockers_fts_idx
  on public.blockers using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));
