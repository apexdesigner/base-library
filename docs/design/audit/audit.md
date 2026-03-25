---
generated-from: design/project.ts
generated-by: design-docs.design-md.md
---
# Audit

The audit feature records create, update, and delete events for business objects that apply the Audit mixin. Events capture the user, timestamp, operation type, and data payload.

## Mixin

- [audit.mixin.ts](audit/audit.mixin.md) — Audit mixin with `AuditConfig` interface supporting `excludeProperties` to exclude large fields from the payload

## Business Object

- [audit-event.business-object.ts](audit-event.business-object.md) — AuditEvent with modelName, modelId, date, userEmail, operation, dataJson, and status

## Base Types

- [audit-event-status.base-type.ts](audit-event-status.base-type.md) — Pending, Complete
- [audit-event-operation.base-type.ts](audit-event-operation.base-type.md) — Create, Update, Delete

## Context

- [audit-context.interface-definition.ts](audit-context.interface-definition.md) — AsyncLocalStorage store shape
- [audit-properties.app-properties.ts](audit-properties.app-properties.md) — Holds the AsyncLocalStorage instance
- [setup-audit-context.app-behavior.ts](setup-audit-context.app-behavior.md) — Initializes at startup
- [audit-context-middleware.app-behavior.ts](audit-context-middleware.app-behavior.md) — Wraps requests with context.run()

## Behaviors

- [audit.record-create-event.behavior.ts](audit/audit.record-create-event.behavior.md) — Before Create: records pending audit event
- [audit.complete-create-events.behavior.ts](audit/audit.complete-create-events.behavior.md) — After Create: completes pending events with model ID
- [audit.record-update-event.behavior.ts](audit/audit.record-update-event.behavior.md) — Before Update: records pending audit event
- [audit.complete-update-events.behavior.ts](audit/audit.complete-update-events.behavior.md) — After Update: completes pending events
- [audit.record-delete-event.behavior.ts](audit/audit.record-delete-event.behavior.md) — Before Delete: records pending audit event
- [audit.complete-delete-events.behavior.ts](audit/audit.complete-delete-events.behavior.md) — After Delete: completes pending events

## Usage

Apply the mixin to any business object:

```typescript
import { applyAuditMixin } from '@mixins';

applyAuditMixin(MyObject, { excludeProperties: ['largeField'] });
```

AuditEvent itself should NOT have the Audit mixin applied (infinite recursion).
