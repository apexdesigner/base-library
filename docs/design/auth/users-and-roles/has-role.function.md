---
generated-from: design/auth/users-and-roles/has-role.function.ts
generated-by: design-docs.function.doc.md
---
# Has Role Function

Checks if the current authenticated user has a specific role.
Reads from the AsyncLocalStorage auth context set by the auth middleware.

**Layer:** Server

## Inputs

| Name | Type | Description |
|------|------|-------------|
| roleName | `string` | The role name to check |

## Output

`boolean` - True if the current user has the role
