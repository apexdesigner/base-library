---
generated-from: design/auth/middleware/auth-context.interface-definition.ts
generated-by: design-docs.interface-definition.doc.md
---
# Auth Context Interface Definition

Authenticated request context stored in AsyncLocalStorage.
Available downstream via `App.auth.context.getStore()`.

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| user | [`User`](../users-and-roles/user.business-object.md) | No | User - Authenticated user instance from the database |
| accessToken | `any` | No | Access Token - Decoded JWT access token claims |
| tenantId | `string` | No | Tenant ID - Tenant identifier extracted from token claims |
| roles | [`Role[]`](../users-and-roles/role.business-object.md) | No | Roles - Authorization roles assigned to this user |
