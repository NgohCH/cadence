# Audit Module

## Ownership

The Audit module owns audit reconstruction and audit-facing views.

This includes:

- reconstructing activity using correlation IDs
- presenting related domain events as one business journey
- exposing provenance and causation information for audit purposes

## Boundary Rules

The Audit module does not become the authoritative store for business-module state.

Business modules remain responsible for producing their own domain events.

Audit consumes those records to reconstruct what happened, who initiated it and how events are related.