---
generated-from: design/audit/audit-event.business-object.ts
generated-by: design-docs.business-object.doc.md
---
# Audit Event Business Object

Records a single audit event for a create, update, or delete operation on a business object.

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `number` | Always | Primary key. |
| modelName | `string` | No | Name of the audited business object. |
| modelId | `number` | No | ID of the audited record. |
| date | `Date` | No | When the event occurred. |
| userEmail | `string` | No | Email of the user who performed the operation. |
| operation | [`AuditEventOperation`](../base-types.md) | No | The operation type: Create, Update, or Delete. |
| dataJson | `string` | No | JSON representation of the data at the time of the operation. |
| status | [`AuditEventStatus`](../base-types.md) | No | Whether the operation completed: Pending or Complete. |
