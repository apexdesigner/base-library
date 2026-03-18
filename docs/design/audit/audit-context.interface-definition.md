---
generated-from: design/audit/audit-context.interface-definition.ts
generated-by: design-docs.interface-definition.doc.md
---
# Audit Context Interface Definition

Request-scoped context for passing audit event IDs between Before and After lifecycle hooks.

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| pendingCreateIds | `number[]` | No | Pending create audit event IDs. |
| pendingUpdateIds | `number[]` | No | Pending update audit event IDs. |
| pendingDeleteIds | `number[]` | No | Pending delete audit event IDs. |
