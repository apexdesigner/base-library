---
generated-from: design/auth/configuration/auth-config.interface-definition.ts
generated-by: design-docs.interface-definition.doc.md
---
# Auth Config Interface Definition

OIDC authentication configuration loaded from `design/server/auth-config.json`.
Individual properties can be overridden with environment variables
(e.g. `AUTH_ISSUER`, `AUTH_CLIENT_ID`).

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| issuer | `string` | Always | Issuer - OIDC issuer URL (e.g. `https://example.auth0.com/`) |
| audience | `string` | Always | Audience - API audience identifier for token validation |
| clientId | `string` | Always | Client ID - OAuth client ID for the SPA |
| jwksUri | `string` | No | JWKS URI - Override for the JSON Web Key Set URI; derived from issuer discovery if not set |
| algorithms | `string[]` | No | Algorithms - Allowed JWT signing algorithms (defaults to `["RS256"]`) |
| tokenCacheTTL | `number` | No | Token Cache TTL - How long to cache validated tokens in seconds (defaults to 3600) |
| requireTenantId | `boolean` | No | Require Tenant ID - Whether requests must include a tenant ID claim |
| domain | `string` | No | Domain - Auth0/OIDC domain for the SPA client; derived from issuer if not set |
| scopes | `string[]` | No | Scopes - Scopes requested by the SPA (defaults to `["openid", "profile", "email"]`) |
| logoutUrl | `string` | No | Logout URL - URL to redirect to after logout |
| useCustomAuth0Domain | `boolean` | No | Use Custom Auth0 Domain - Whether the SPA uses an Auth0 custom domain |
