---
generated-from: design/audit/audit-properties.app-properties.ts
generated-by: design-docs.app-properties.doc.md
---
# Audit Properties App Properties

Server-side singleton state for the audit system. Holds the async context for passing audit event IDs between lifecycle hooks.

**Access:** `App.auditProperties.<propertyName>`

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| context | `AsyncLocalStorage<AuditContext>` | No | Context - AsyncLocalStorage for audit request context |
