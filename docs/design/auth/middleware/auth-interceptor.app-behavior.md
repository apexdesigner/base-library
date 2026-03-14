---
generated-from: design/auth/middleware/auth-interceptor.app-behavior.ts
generated-by: design-docs.app-behavior.doc.md
---
# Auth Interceptor App Behavior

Attaches the OIDC access token to outgoing API requests.

**Type:** Interceptor

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| req | `HttpRequest<unknown>` | Yes |  |
| next | `HttpHandlerFn` | Yes |  |
| authService | `AuthService` | Yes |  |
