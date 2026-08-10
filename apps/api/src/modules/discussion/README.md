# Discussion Module

## Ownership

The Discussion module owns authoritative discussion state.

This includes:

- discussion messages
- message versions
- message-related domain events

## Boundary Rules

Discussion operations must enforce the required permissions through RBAC.

The Discussion module owns persistence of messages and message versions.

Posting a message must eventually atomically persist:

Message
+
Message Version
+
MessageCreated.v1

The Discussion module does not create tasks directly.

Other modules may react to Discussion domain events without taking ownership of Discussion state.