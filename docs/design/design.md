---
generated-from: design/project.ts
generated-by: design-docs.design-md.md
---
# Base Library

The base library provides authentication, shared UI components, and common base types for Apex Designer applications. It also includes generators for building an Angular frontend and Express.js backend.

## Feature Areas

The [auth](auth/auth.md) feature provides OIDC-based authentication and role-based access control, including users, roles, role assignments, route guards, and auth-related UI components.

The [audit](audit/audit.md) feature records create, update, and delete events for business objects that apply the Audit mixin, with configurable property exclusion and AsyncLocalStorage-based context coordination.

The [slack-alerts](slack-alerts/slack-alerts.md) feature sends lifecycle notifications (startup, shutdown, errors) to a Slack channel via webhook.

The [components](components/components.md) directory contains the root app component and shared UI components including accordions, add-button dialogs, breadcrumb navigation, confirmation directives, delete buttons, edit/error dialogs, import/export TSV, refresh, and search.

## Foundation

The [base-types](base-types/base-types.md) directory defines application-level type wrappers for common data formats like email, phone, currency, and UUID.

The `external-items` directory contains Angular, CDK, and Material framework type definitions, component interfaces, directive interfaces, and pipe interfaces used across the application. These are extracted from external libraries and do not require separate documentation.

## Testing

The testing directory provides business objects, pages, and behaviors used to exercise the base library's generators and runtime features.

## Static Files

The `client` and `server` directories hold static file overrides that are copied into the generated output.
