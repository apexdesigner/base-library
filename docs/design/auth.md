---
generated-from: design/auth/auth.app-properties.ts
generated-by: design-docs.app-properties.doc.md
---
# Auth

Server-side singleton state for authentication. Holds the JWKS client,
user profile cache, and in-flight request deduplication.

**Access:** `App.auth.<propertyName>`

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| config | `AuthConfig` | No | Config - OIDC configuration loaded at startup |
| jwksClient | `jwksRsa.JwksClient` | No | JWKS Client - Lazily initialized client for fetching JSON Web Key Sets |
| userProfileCache | `Map<string, any>` | No | User Profile Cache - Cached userinfo responses keyed by subject claim |
| inFlightRequests | `Map<string, any>` | No | In-Flight Requests - Deduplicates concurrent userinfo fetches by subject claim |
| cacheCleanupInterval | `ReturnType<typeof setInterval>` | No | Cache Cleanup Interval - Timer handle for periodic cache expiration |
