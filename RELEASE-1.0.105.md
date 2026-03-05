# Release 1.0.105

## Summary

This release adds full OIDC authentication infrastructure to the base library, including server-side JWT middleware, client-side Angular auth service, role-based access control, and several generator improvements.

## Breaking Changes

### Routes generator no longer reads `defaultPage` from Project

The `client-routes` generator no longer reads `Project.defaultPage`. Instead, use the new `isDefault: true` option on the `@page()` decorator:

```typescript
// Before (no longer works)
export class MyProject extends Project {
  defaultPage = TestItemsPage;
}

// After
@page({ path: '/test-items', isDefault: true })
export class TestItemsPage extends Page {}
```

Requires `@apexdesigner/dsl >= 0.8.59`.

### Data source generator now throws on unfixable schema issues

Previously, `validateSchema()` results were partially checked. Now the generator collects all differences from `tables` and `views`, applies auto-fixes, and **throws** if unfixable issues remain. Existing databases with schema drift may fail on startup until manually migrated (e.g., dropping stale columns, adding NOT NULL constraints).

## New Features

### Auth Infrastructure (Design Files)

Complete OIDC authentication added as library design files in `design/auth/`:

- **AuthService** (`auth.service.ts`) — Client-side auth state, login/logout, role checking, return URL after login
- **Auth Middleware** (`auth-middleware.app-behavior.ts`) — Server-side JWT validation with `sub -> email` cache and auto user creation
- **Setup Auth** (`setup-auth.app-behavior.ts`) — Loads OIDC config from `auth-config.json` with env var overrides
- **Provide Auth** (`provide-auth.app-behavior.ts`) — Angular OIDC provider with Auth0 custom domain support
- **Auth Interceptor** (`auth-interceptor.app-behavior.ts`) — Attaches Bearer tokens to `/api/` requests using `switchMap`
- **Role Guard** (`role-guard.app-behavior.ts`) — Redirects unauthenticated users to `/login`, checks role-based access
- **Sync Static Roles** (`sync-static-roles.app-behavior.ts`) — Syncs DSL-defined roles to the database at startup
- **Assign Default Administrators** (`assign-default-administrators.app-behavior.ts`) — Creates users from `ADMINISTRATOR_EMAILS` env var and assigns Administrator role
- **Get Auth Config** (`get-auth-config.app-behavior.ts`) — Public endpoint returning client OIDC config
- **Login Page** (`login.page.ts`) — Public login page with `roles: [Everyone]`
- **Avatar Component** (`avatar/avatar.component.ts`) — User menu with email display and logout

### Auth Business Objects

- **User** — email-only model with unique constraint
- **Role** — name, displayName, description
- **RoleAssignment** — links users to roles
- **User.currentUser()** behavior — returns authenticated user from auth context

### Auth Interface Definitions

- **AuthConfig** — OIDC configuration schema (issuer, audience, clientId, jwksUri, etc.)
- **AuthContext** — request-scoped auth context (user, token, email)

### Auth App Properties

- `App.auth.config` — parsed auth configuration
- `App.auth.context` — AsyncLocalStorage for request-scoped auth
- `App.auth.jwksClient` — JWKS key resolver
- `App.auth.subEmailCache` — sub-to-email mapping cache
- `App.auth.isPublicRoute` — function to check if a path is public

### New Generators

| Generator | Output | Description |
|-----------|--------|-------------|
| `clientProviderGenerator` | `client/src/app/providers/*.ts` | Angular environment providers from `Provider` app behaviors |
| `clientInterceptorGenerator` | `client/src/app/interceptors/*.ts` | Angular HTTP interceptors from `Interceptor` app behaviors |
| `clientGuardGenerator` | `client/src/app/guards/*.guard.ts` | Angular route guards from `Guard` app behaviors |
| `clientInterfaceDefinitionsGenerator` | `client/src/app/interface-definitions/*.ts` | Client-side interface definition types |
| `serverInterfaceDefinitionsGenerator` | `server/src/schemas/interface-definitions/*.ts` | Server-side Zod schemas from interface definitions |
| `interfaceDefinitionSchemaGenerator` | `server/src/schemas/interface-definitions/*.ts` | Zod schema generation for interface definitions |
| `roleDefinitionsGenerator` | `server/src/auth/role-definitions.ts` | Static role definitions from DSL roles |
| `publicRoutesGenerator` | `server/src/routes/public-routes.ts` | Public route paths from `Everyone` role behaviors |
| `serverFunctionGenerator` | `server/src/functions/*.ts` | Server-side function files |

### Generator Improvements

- **Lifecycle generator** preserves `createDebug()` namespaces from design files instead of generating its own
- **Data source generator** reports unfixable schema differences with messages and throws
- **Client routes generator** uses `isDefault` page option for default route
- **Client routes generator** applies guards to all pages except `Everyone` role pages

## New Dependencies

### Server
- `jsonwebtoken` — JWT verification
- `jwks-rsa` — JWKS key fetching
- `path-to-regexp` — public route matching

### Client
- `angular-auth-oidc-client` — OIDC client library

### Dev
- `@apexdesigner/dsl` updated to `^0.8.59`

## Configuration

Auth is configured via `auth-config.json` (placed in `design/server/`) with environment variable overrides:

| Config Key | Env Var | Required | Description |
|-----------|---------|----------|-------------|
| `issuer` | `AUTH_ISSUER` | Yes | OIDC issuer URL |
| `audience` | `AUTH_AUDIENCE` | Yes | API audience |
| `clientId` | `AUTH_CLIENT_ID` | Yes | OIDC client ID |
| `useCustomAuth0Domain` | `AUTH_USE_CUSTOM_AUTH0_DOMAIN` | No | Enable Auth0 custom domain logout |
| `logoutUrl` | `AUTH_LOGOUT_URL` | No | Custom logout URL for non-Auth0 IdPs |

Set `AUTH_DISABLED=true` to disable auth entirely.
Set `ADMINISTRATOR_EMAILS=a@b.com,c@d.com` to auto-assign Administrator role.
