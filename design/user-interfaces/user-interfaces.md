# User Interfaces

The user-interfaces directory contains shared UI components used across the application.

## App Component

The [app](app.component.ts) component is the root application component. It renders the toolbar with the project name, an [avatar](../auth/components/avatar.component.ts) for authenticated users, and the router outlet. It also registers the select-user and select-role schema form fields on load.

## Add Button

The [add button](add-button/add-button.component.ts) component and associated [dialog](add-button/add-dialog.component.ts) provide a standard way to add records to a persisted array. The button opens a dialog that dynamically loads a schema-driven form for the array's entity type. It accepts an optional label and dialog width, and emits the newly added record.

## Breadcrumb

The [breadcrumb](breadcrumb/breadcrumb.component.ts) component displays navigation breadcrumbs. It contains [breadcrumb level](breadcrumb/breadcrumb-level.component.ts) children, each rendering as a router link when a path is set or plain text for the current level. Levels are separated by a delimiter automatically.
