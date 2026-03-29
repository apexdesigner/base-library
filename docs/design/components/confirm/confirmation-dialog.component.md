---
generated-from: design/components/confirm/confirmation-dialog.component.ts
generated-by: design-docs.component.doc.md
---
# Confirmation Dialog Component

A simple Material dialog that displays a message with Cancel and Confirm buttons.
Used by the confirm directive to prompt the user before destructive actions.

**Type:** Dialog

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
| message | `string` | Always | Message - The confirmation message to display |

## Outputs

| Name | Type | Description |
|------|------|-------------|
| confirmed | `EventEmitter<void>` | Confirmed - Emitted when the user clicks Confirm |
| canceled | `EventEmitter<void>` | Canceled - Emitted when the user clicks Cancel |
