# Tasks Module

## Ownership

The Tasks module owns authoritative task state.

This includes:

- task creation
- task assignment
- task persistence
- task-related domain events
- task provenance/source links

## Boundary Rules

Only the Tasks module may create or modify authoritative task state.

Other modules must request task operations through TasksService.

TasksService is responsible for enforcing the permissions required by the target operation, including:

- task.create
- task.assign when an assignee is specified