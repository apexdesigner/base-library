---
generated-from: design/audit/audit/audit.mixin.ts
generated-by: design-docs.mixin.doc.md
---
# Audit Mixin

Records audit events for create, update, and delete operations with configurable property exclusion.

## Behaviors

| Name | Type | Method | Description |
|------|------|--------|-------------|
| [completeCreateEvents](audit.complete-create-events.behavior.md) | After Create |  | Marks pending create audit events as complete after the record is created. |
| [completeDeleteEvents](audit.complete-delete-events.behavior.md) | After Delete |  | Marks pending delete audit events as complete after records are deleted. |
| [completeUpdateEvents](audit.complete-update-events.behavior.md) | After Update |  | Marks pending update audit events as complete after records are updated. |
| [recordCreateEvent](audit.record-create-event.behavior.md) | Before Create |  | Records a pending audit event before a record is created. |
| [recordDeleteEvent](audit.record-delete-event.behavior.md) | Before Delete |  | Records pending audit events before records are deleted, capturing the full record data. |
| [recordUpdateEvent](audit.record-update-event.behavior.md) | Before Update |  | Records pending audit events before records are updated. |
