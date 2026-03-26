---
generated-from: design/user-interfaces/accordion/accordion.component.ts
generated-by: design-docs.component.doc.md
---
# Accordion Component

A data-driven expansion panel list. Takes a business object array and
renders a mat-accordion with one mat-expansion-panel per item. Each panel
shows the item's display name in the header and sf-fields in the body.
Built-in support for adding, deleting, and navigating to an item's detail page via routerLink.

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
| array | `PersistedArray<any> \| PersistedFormArray` | Always | The list of business objects to display. |
| defaults | `Record<string, any>` | No | Default values when adding a new item. |
| routePrefix | `string` | No | URL prefix for the launch link. |
| routeFunction | `(item: any) => string` | No | Custom function returning the route for an item. |

## Outputs

| Name | Type | Description |
|------|------|-------------|
| deleted | `EventEmitter<any>` | Emitted when an item is deleted. |
