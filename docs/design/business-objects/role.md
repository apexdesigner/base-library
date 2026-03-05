---
generated-from: design/business-objects/role/role.business-object.ts
generated-by: design-docs.business-object.doc.md
---
# Role

Named authorization role that can be assigned to users.

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `number` | Always | ID - Primary key |
| name | `string` | Editing | Name - Unique role identifier |
| displayName | `string` | No | Display Name - Human-readable role label |
| description | `string` | No | Description - Role purpose and permissions summary |

## Relationships

| Name | Type | Relationship | Description |
|------|------|--------------|-------------|
| roleAssignments | [`RoleAssignment[]`](role-assignment.md) | Has Many | Role Assignments - Users assigned to this role |
