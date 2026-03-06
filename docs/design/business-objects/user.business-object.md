---
generated-from: design/business-objects/user/user.business-object.ts
generated-by: design-docs.business-object.doc.md
---
# User Business Object

Authenticated user identified by email address.

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `number` | Always | ID - Primary key |
| email | `string` | Always | Email - User email address |

## Relationships

| Name | Type | Relationship | Description |
|------|------|--------------|-------------|
| roleAssignments | [`RoleAssignment[]`](role-assignment.business-object.md) | Has Many | Role Assignments - Roles assigned to this user |

## Class Behaviors

| Name | Description | Input | Type | Output |
|------|-------------|-------|------|--------|
| currentUser | GET |  |  |  |
