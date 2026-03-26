---
generated-from: design/user-interfaces/edit-dialog/edit-dialog.component.ts
generated-by: design-docs.component.doc.md
---
# Edit Dialog Component

A Material dialog for editing a business object inline. Opens as a modal,
auto-renders all fields using sf-fields, and optionally provides a delete
button. Used within list/table views to edit items without navigating away.

**Type:** Dialog

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
| object | `PersistedFormGroup` | Always | Object - The business object to edit |

## Outputs

| Name | Type | Description |
|------|------|-------------|
| deleted | `EventEmitter<void>` | Deleted - Emitted after the object is deleted via the dialog |
