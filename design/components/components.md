# Components

The components directory contains shared UI components used across the application.

## App Component

The [app](app.component.ts) component is the root application component. It renders the toolbar with the project name, an [avatar](../auth/components/avatar.component.ts) for authenticated users, and the router outlet. It also registers the select-user and select-role schema form fields on load.

## Add Button

The [add button](add-button/add-button.component.ts) component and associated [dialog](add-button/add-dialog.component.ts) provide a standard way to add records to a persisted array. The button opens a dialog that dynamically loads a schema-driven form for the array's entity type. It accepts an optional label and dialog width, and emits the newly added record.

## Add Field

The [add field](add-field.component.ts) component is an inline text input for adding new items to a business object array. Types a name, presses Enter, and the item is created.

## Accordion

The [accordion](accordion.component.ts) component is a data-driven expansion panel list that takes a business object array and renders a mat-accordion with sf-fields in each panel. Supports adding, deleting, and navigating to detail pages.

## Breadcrumb

The [breadcrumb](breadcrumb/breadcrumb.component.ts) component displays navigation breadcrumbs. It contains [breadcrumb level](breadcrumb/breadcrumb-level.component.ts) children, each rendering as a router link when a path is set or plain text for the current level. Levels are separated by a delimiter automatically.

## Confirm

The [confirm directive](confirm/confirm.directive.ts) intercepts click events and shows a [confirmation dialog](confirm/confirmation-dialog.component.ts) before allowing the action to proceed.

## Delete Button

The [delete button](delete-button.component.ts) component deletes a business object with a confirmation prompt and navigates to a specified route after deletion.

## Edit Dialog

The [edit dialog](edit-dialog.component.ts) component opens a Material dialog for inline editing of a business object using sf-fields.

## Error Dialog

The [error dialog](error-dialog.component.ts) component displays a list of error messages in a Material dialog with a Close button.

## Export TSV Button

The [export TSV button](export-tsv-button.component.ts) component exports a business object array to a tab-separated values file download.

## Import TSV

The [import TSV button](import-tsv/import-tsv-button.component.ts) component opens an [import dialog](import-tsv/import-tsv-dialog.component.ts) for importing tab-separated values into a business object array.

## Refresh Button

The [refresh button](refresh-button.component.ts) component re-reads a business object array with a single click.

## Search Bar

The [search bar](search-bar.component.ts) component filters a business object array with debounced server-side search across all string properties.
