---
generated-from: design/auth/middleware/auth-middleware.app-behavior.ts
generated-by: design-docs.app-behavior.doc.md
---
# Auth Middleware App Behavior

Validates JWT bearer tokens, resolves the user by email,
and stores the authenticated context in AsyncLocalStorage.

**Type:** Middleware

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| req | `any` | Yes |  |
| res | `any` | Yes |  |
| next | `() => void` | Yes |  |
