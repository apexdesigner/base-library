---
generated-from: design/components/add-button/add-dialog.component.ts
generated-by: design-docs.component.doc.md
---
# Add Dialog Component

Dialog for adding a new record to a persisted array. Dynamically loads a
schema-driven form using BusinessObjectService based on the array's entity name.
Hidden fields are automatically disabled so they don't block form validity.

**Type:** Dialog

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
| array | `PersistedArray<any> \| PersistedFormArray` | Always | The persisted array or form array to add new records to. |
| label | `string` | No | Title displayed in the dialog header. |

## Outputs

| Name | Type | Description |
|------|------|-------------|
| added | `EventEmitter<any>` | Emits the newly added entity or form group after a successful add. |
