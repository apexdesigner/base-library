# Audit

The audit feature records create, update, and delete events for business objects that apply the Audit mixin. Events capture the user, timestamp, operation type, and data payload.

## Mixin

- [audit.mixin.ts](audit/audit.mixin.ts) — Audit mixin with `AuditConfig` interface supporting `excludeProperties` to exclude large fields from the payload

## Business Object

- [audit-event.business-object.ts](audit-event.business-object.ts) — AuditEvent with modelName, modelId, date, userEmail, operation, dataJson, and status

## Base Types

- [audit-event-status.base-type.ts](audit-event-status.base-type.ts) — Pending, Complete
- [audit-event-operation.base-type.ts](audit-event-operation.base-type.ts) — Create, Update, Delete

## Context

- [audit-context.interface-definition.ts](audit-context.interface-definition.ts) — AsyncLocalStorage store shape
- [audit-properties.app-properties.ts](audit-properties.app-properties.ts) — Holds the AsyncLocalStorage instance
- [setup-audit-context.app-behavior.ts](setup-audit-context.app-behavior.ts) — Initializes at startup
- [audit-context-middleware.app-behavior.ts](audit-context-middleware.app-behavior.ts) — Wraps requests with context.run()

## Behaviors

- [audit.record-create-event.behavior.ts](audit/audit.record-create-event.behavior.ts) — Before Create: records pending audit event
- [audit.complete-create-events.behavior.ts](audit/audit.complete-create-events.behavior.ts) — After Create: completes pending events with model ID
- [audit.record-update-event.behavior.ts](audit/audit.record-update-event.behavior.ts) — Before Update: records pending audit event
- [audit.complete-update-events.behavior.ts](audit/audit.complete-update-events.behavior.ts) — After Update: completes pending events
- [audit.record-delete-event.behavior.ts](audit/audit.record-delete-event.behavior.ts) — Before Delete: records pending audit event
- [audit.complete-delete-events.behavior.ts](audit/audit.complete-delete-events.behavior.ts) — After Delete: completes pending events

## Usage

Apply the mixin to any business object:

```typescript
import { applyAuditMixin } from '@mixins';

applyAuditMixin(MyObject, { excludeProperties: ['largeField'] });
```

AuditEvent itself should NOT have the Audit mixin applied (infinite recursion).
