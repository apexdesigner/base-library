---
generated-from: design/auth/users-and-roles/current-user.function.ts
generated-by: design-docs.function.doc.md
---
# Current User Function

Returns the authenticated user from the AsyncLocalStorage auth context.
Throws if no authenticated user is present in the context.

**Layer:** Server

## Output

`User` - The current authenticated user
