# Cadence Database Migration Package Changelog

## 0.1.0 - 2026-08-08

### Added
- Initial executable Supabase/PostgreSQL migration sequence.
- Application identity and Supabase Auth mapping.
- Project-scoped RBAC and platform-role separation.
- Native discussion model with immutable message versions.
- Topics, decisions, tasks, blockers, milestones, and file metadata.
- Provenance and generic entity-link structures.
- Team Agent run/proposal tracking and prompt versioning.
- Transactional outbox domain events and idempotency registry.
- Append-only operational audit trail.
- Independent Project Health module state/history.
- RLS helper functions, read policies, indexes, full-text search baseline.
- Explicit Project Owner transfer permission and security invariants.
- Raw AI-run records kept server-only.
- Seed roles and permissions.
- Schema smoke test and manual RLS checklist.
