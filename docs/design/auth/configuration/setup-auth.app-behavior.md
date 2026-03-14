---
generated-from: design/auth/configuration/setup-auth.app-behavior.ts
generated-by: design-docs.app-behavior.doc.md
---
# Setup Auth App Behavior

Loads OIDC configuration from `auth-config.json` with environment variable
overrides and initializes authentication state on App.auth at startup.
Auth is enabled by default; set `AUTH_DISABLED=true` to disable.

**Type:** Lifecycle Behavior

**Stage:** Startup
