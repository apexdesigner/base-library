---
generated-from: design/business-objects/user/user.business-object.ts
generated-by: design-docs.business-object.doc.md
---
# User

Authenticated user identified by their OIDC subject claim.

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `number` | Always | ID - Primary key |
| sub | `string` | Always | Sub - OIDC subject identifier |
| email | `string` | No | Email - User email address |
| name | `string` | No | Name - User display name |

## Relationships

| Name | Type | Relationship | Description |
|------|------|--------------|-------------|
| roleAssignments | [`RoleAssignment[]`](role-assignment.md) | Has Many | Role Assignments - Roles assigned to this user |
