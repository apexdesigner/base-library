---
generated-from: design/auth/client/auth.service.ts
generated-by: design-docs.service.doc.md
---
# Auth Service Service

Client-side authentication state and actions. Fetches the auth config
and current user on load and provides role checking, login, and logout.

Consumers can access auth state two ways:
- **Subscription**: `authService.currentUser` emits whenever the current user changes
- **Async**: `await authService.getCurrentUser()` resolves with the user once initialization completes

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authenticated | `Observable<boolean>` | No | Is Authenticated - Observable that emits the authentication state on each change |
| currentUser | `Observable<User>` | No | Current User - Observable that emits the current user on each change |
| authEnabled | `Observable<boolean>` | No | Auth Enabled - Observable that emits whether auth is configured on each change |
| oidcSecurityService | `OidcSecurityService` | Always | Oidc Security Service - Injected OIDC client for login and logout |
| router | `Router` | Always | Router - Angular router for post-login navigation |
| returnUrl | `string` | No | Return URL - URL to navigate to after login |
| readyResolve | `() => void` | Always | Ready Resolve - Resolves the ready promise when initialization completes |
| accessToken | `Observable<string>` | No | Access Token - Observable that emits the current OIDC access token |
