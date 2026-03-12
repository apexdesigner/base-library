---
generated-from: design/auth/users-and-roles/role-assignment.business-object.ts
generated-by: design-docs.business-object.doc.md
---
# Role Assignment Business Object

Associates a user with a role. Belongs to User (cascade delete),
references Role (prevents deletion while assignments exist).

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `number` | Always | ID - Primary key |
| userId | `number` | Always | User ID - Foreign key to user |
| roleId | `number` | No | Role ID - Foreign key to role |

## Relationships

| Name | Type | Relationship | Description |
|------|------|--------------|-------------|
| user | [`User`](user.business-object.md) | Belongs To | User - Assigned user |
| role | [`Role`](role.business-object.md) | References | Role - Assigned role |
