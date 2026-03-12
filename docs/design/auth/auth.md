---
generated-from: design/project.ts
generated-by: design-docs.design-md.md
---
# Auth

The auth feature provides OIDC-based authentication and role-based access control for the application.

## Configuration

The [setup-auth](configuration/setup-auth.app-behavior.md) app behavior loads OIDC configuration from `auth-config.json` at startup, with environment variable overrides for each property (e.g., `AUTH_ISSUER`, `AUTH_CLIENT_ID`). The configuration is validated against the [auth config](configuration/auth-config.interface-definition.md) schema. Auth is enabled by default; set `AUTH_DISABLED=true` to disable. The [auth](configuration/auth.app-properties.md) app properties hold the runtime auth state including the JWKS client, token caches, and public route matcher.

The [provide-auth](configuration/provide-auth.app-behavior.md) app behavior registers the OIDC module with the Angular client, and the [get-auth-config](configuration/get-auth-config.app-behavior.md) app behavior exposes the client-facing configuration via API.

## Server Middleware

The [auth middleware](middleware/auth-middleware.app-behavior.md) app behavior validates JWT tokens on incoming requests and resolves the authenticated user. The [auth interceptor](middleware/auth-interceptor.app-behavior.md) app behavior attaches the access token to outgoing HTTP requests from the client. The [auth context](middleware/auth-context.interface-definition.md) interface definition carries the authenticated user through async request handling.

## Users and Roles

A [User](users-and-roles/user.business-object.md) business object represents an authenticated person. The [current user](users-and-roles/user.current-user.behavior.md) behavior fetches the user record for the active session. The [current-user](users-and-roles/current-user.function.md) function provides a server-side helper to retrieve the user from the auth context.

A [Role](users-and-roles/role.business-object.md) business object defines a named permission group. A [Role Assignment](users-and-roles/role-assignment.business-object.md) business object links a user to a role. The [sync-static-roles](users-and-roles/sync-static-roles.app-behavior.md) app behavior ensures roles declared in design files exist in the database at startup. The [assign-default-administrators](users-and-roles/assign-default-administrators.app-behavior.md) app behavior grants the [administrator](users-and-roles/administrator.role.md) role to initial users.

The [has-role](users-and-roles/has-role.function.md) function checks whether a user holds a given role.

## Client

The [auth service](client/auth.service.md) service manages client-side authentication state. It checks the OIDC session on load, fetches the current user, and exposes observables for authentication status and the current user. It also provides login, logout, and role-checking methods.

The [role guard](client/role-guard.app-behavior.md) guard protects routes by checking authentication and required roles. If the user was rejected by the server (not a known user), it skips the login redirect and allows the not-authorized page to handle it.

## Pages

The [login](pages/login.page.md) page initiates the OIDC login flow. The [not-authorized](pages/not-authorized.page.md) page displays when a user is authenticated but not permitted. The [switch-user](pages/switch-user.page.md) page allows switching between user accounts during development.

## Components

The [avatar](components/avatar.component.md) component displays the current user's identity in the toolbar with a menu for logout and user switching. The [manage role assignments](components/manage-role-assignments.component.md) component provides a UI for assigning roles to users. The [select user field](components/select-user-field.component.md) and [select role field](components/select-role-field.component.md) components are schema form fields for picking users and roles.
