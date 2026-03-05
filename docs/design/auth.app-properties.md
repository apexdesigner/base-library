---
generated-from: design/auth/auth.app-properties.ts
generated-by: design-docs.app-properties.doc.md
---
# Auth App Properties

Server-side singleton state for authentication. Holds the JWKS client,
sub-to-email cache, and async context for authenticated requests.

**Access:** `App.auth.<propertyName>`

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| config | `AuthConfig` | No | Config - OIDC configuration loaded at startup |
| jwksClient | `jwksRsa.JwksClient` | No | JWKS Client - Lazily initialized client for fetching JSON Web Key Sets |
| subEmailCache | `Map<string, string>` | No | Sub Email Cache - Maps OIDC subject claims to email addresses for fast lookup |
| inFlightRequests | `Map<string, Promise<string \| null>>` | No | In-Flight Requests - Deduplicates concurrent userinfo fetches by subject claim |
| isPublicRoute | `(path: string) => boolean` | No | Is Public Route - Function that checks if a request path is public |
| context | `AsyncLocalStorage<AuthContext>` | No | Context - AsyncLocalStorage for authenticated request context |
