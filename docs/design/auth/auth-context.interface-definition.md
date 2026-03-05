---
generated-from: design/auth/auth-context.interface-definition.ts
generated-by: design-docs.interface-definition.doc.md
---
# Auth Context Interface Definition

Authenticated request context stored in AsyncLocalStorage.
Available downstream via `App.auth.context.getStore()`.

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| accessToken | `any` | No | Access Token - Decoded JWT access token claims |
| tenantId | `string` | No | Tenant ID - Tenant identifier extracted from token claims |
| roles | `Role[]` | No | Roles - Authorization roles assigned to this user |
