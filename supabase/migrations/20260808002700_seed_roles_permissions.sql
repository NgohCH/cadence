-- Cadence v0.1
-- Migration: baseline roles and permission bundles

insert into public.roles (code, name, description, scope, is_system_role)
values
  ('PROJECT_OWNER', 'Project Owner', 'Full project authority and ownership responsibilities.', 'project', true),
  ('PROJECT_LEAD', 'Project Lead', 'Operational project leadership and coordination.', 'project', true),
  ('CONTRIBUTOR', 'Contributor', 'Regular project participant who contributes work.', 'project', true),
  ('REVIEWER', 'Reviewer / Approver', 'Reviews project work and approves authorised decisions.', 'project', true),
  ('VIEWER', 'Viewer', 'Read-only project participant.', 'project', true),
  ('SYSTEM_ADMIN', 'System Administrator', 'Platform administration only; does not imply project-content access.', 'platform', true)
on conflict (code) do nothing;

insert into public.permissions (code, description)
values
  ('platform.admin', 'Administer Cadence platform configuration.'),
  ('platform.user_manage', 'Create, disable, and manage platform users.'),
  ('platform.role_manage', 'Manage role and permission definitions.'),
  ('platform.project_create', 'Create new project containers.'),
  ('project.view', 'View a project.'),
  ('project.edit', 'Edit project metadata and goal.'),
  ('project.change_lifecycle', 'Change project lifecycle state.'),
  ('project.export', 'Export project information.'),
  ('member.view', 'View project members.'),
  ('member.invite', 'Add users to a project.'),
  ('member.remove', 'Remove users from a project.'),
  ('member.change_role', 'Change project-member roles within allowed transitions.'),
  ('member.assign_owner', 'Assign or transfer the Project Owner role.'),
  ('message.view', 'View project discussion.'),
  ('message.create', 'Post project messages.'),
  ('message.edit_own', 'Edit own messages with version history.'),
  ('message.delete_own', 'Soft-delete own messages.'),
  ('message.moderate', 'Moderate project messages.'),
  ('message.react', 'Add or remove reactions.'),
  ('topic.view', 'View project topics.'),
  ('topic.create', 'Create project topics.'),
  ('topic.update', 'Update project topics.'),
  ('topic.change_status', 'Change topic lifecycle state.'),
  ('decision.view', 'View project decisions.'),
  ('decision.propose', 'Propose a project decision.'),
  ('decision.approve', 'Confirm or approve project decisions.'),
  ('decision.supersede', 'Supersede an existing decision.'),
  ('decision.withdraw', 'Withdraw a decision.'),
  ('task.view', 'View project tasks.'),
  ('task.create', 'Create project tasks.'),
  ('task.assign', 'Assign project tasks to members.'),
  ('task.update_own', 'Update tasks assigned to self.'),
  ('task.update_any', 'Update any project task.'),
  ('task.complete_own', 'Complete tasks assigned to self.'),
  ('task.complete_any', 'Complete any project task.'),
  ('task.cancel_any', 'Cancel any project task.'),
  ('blocker.view', 'View project blockers.'),
  ('blocker.create', 'Create project blockers.'),
  ('blocker.update', 'Update project blockers.'),
  ('blocker.resolve', 'Resolve project blockers.'),
  ('blocker.reopen', 'Reopen resolved blockers.'),
  ('milestone.view', 'View project milestones.'),
  ('milestone.create', 'Create milestones.'),
  ('milestone.update', 'Update milestones.'),
  ('milestone.complete', 'Complete milestones.'),
  ('file.view', 'View project file metadata and authorised files.'),
  ('file.upload', 'Upload project files.'),
  ('file.link', 'Link files to project entities.'),
  ('file.delete_own', 'Soft-delete own uploaded files.'),
  ('file.delete_any', 'Soft-delete project files.'),
  ('agent.use', 'Use the Cadence Team Agent.'),
  ('agent.approve', 'Approve or reject Team Agent proposals.'),
  ('audit.view', 'View project audit history.'),
  ('project_health.view', 'View project health and reasons.'),
  ('project_health.override', 'Set or confirm project health manually.'),
  ('alert.view', 'View project alerts.'),
  ('alert.manage', 'Create or dismiss managed project alerts.'),
  ('activity.view', 'View project activity feed.'),
  ('notification.view', 'View personal notifications.')
on conflict (code) do nothing;

-- System Administrator gets platform permissions only. It does not imply project access.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'platform.admin', 'platform.user_manage', 'platform.role_manage', 'platform.project_create'
)
where r.code = 'SYSTEM_ADMIN'
on conflict do nothing;

-- Project Owner gets every project-scoped permission (all non-platform permissions).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'PROJECT_OWNER'
  and p.code not like 'platform.%'
on conflict do nothing;

-- Project Lead: broad operational control, including audit and AI approval.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'project.view','project.edit','project.change_lifecycle','project.export',
  'member.view','member.invite','member.remove','member.change_role',
  'message.view','message.create','message.edit_own','message.delete_own','message.moderate','message.react',
  'topic.view','topic.create','topic.update','topic.change_status',
  'decision.view','decision.propose','decision.approve','decision.supersede','decision.withdraw',
  'task.view','task.create','task.assign','task.update_own','task.update_any','task.complete_own','task.complete_any','task.cancel_any',
  'blocker.view','blocker.create','blocker.update','blocker.resolve','blocker.reopen',
  'milestone.view','milestone.create','milestone.update','milestone.complete',
  'file.view','file.upload','file.link','file.delete_own','file.delete_any',
  'agent.use','agent.approve','audit.view',
  'project_health.view','project_health.override',
  'alert.view','alert.manage','activity.view','notification.view'
)
where r.code = 'PROJECT_LEAD'
on conflict do nothing;

-- Contributor: active participation without governance-level authority.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'project.view','member.view',
  'message.view','message.create','message.edit_own','message.delete_own','message.react',
  'topic.view','topic.create','topic.update',
  'decision.view','decision.propose',
  'task.view','task.create','task.update_own','task.complete_own',
  'blocker.view','blocker.create','blocker.update',
  'milestone.view',
  'file.view','file.upload','file.link','file.delete_own',
  'agent.use','project_health.view','alert.view','activity.view','notification.view'
)
where r.code = 'CONTRIBUTOR'
on conflict do nothing;

-- Reviewer / Approver: review-oriented role with explicit decision approval.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'project.view','member.view',
  'message.view','message.create','message.react',
  'topic.view',
  'decision.view','decision.approve',
  'task.view','blocker.view','milestone.view','file.view',
  'agent.use','agent.approve','project_health.view','alert.view','activity.view','notification.view'
)
where r.code = 'REVIEWER'
on conflict do nothing;

-- Viewer: read-only project awareness.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'project.view','member.view','message.view','topic.view','decision.view','task.view',
  'blocker.view','milestone.view','file.view','project_health.view','alert.view','activity.view','notification.view'
)
where r.code = 'VIEWER'
on conflict do nothing;
