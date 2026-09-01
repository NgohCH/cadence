# Project Health Module

The Project Health module owns authoritative current health state and Health
history semantics, including:

- `public.project_health`;
- `public.project_health_history`.

The Projects module may aggregate current Health for its workspace read model,
but it does not own or mutate Health persistence.

The pilot preparation contract is a narrow server-side, create-only boundary
for controlled operator bootstrap. It is not a browser route, public Health
API, self-service flow, or replacement for future governed Health operations.
It creates or reuses exact current Health state and never writes artificial
history merely because a baseline is prepared.
