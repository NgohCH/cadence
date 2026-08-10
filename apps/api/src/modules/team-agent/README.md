# Team Agent Module

## Ownership

The Team Agent module owns:

- AI-generated proposals
- proposal validation
- proposal review and confirmation workflow
- AI provenance related to proposals

## Boundary Rules

The Team Agent module does not own Tasks.

It must never:

- insert directly into task tables
- update task records directly
- call Tasks repositories directly
- bypass Tasks module permissions

When a confirmed proposal requires a task to be created, the Team Agent service must call the Tasks service.

Expected flow:

TeamAgentService.confirmProposal()
→ RBAC checks agent.approve
→ TasksService.createTask()
→ Tasks module performs task.create and task.assign checks
→ Tasks module persists the task