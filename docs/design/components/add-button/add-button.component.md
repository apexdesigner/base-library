---
generated-from: design/components/add-button/add-button.component.ts
generated-by: design-docs.component.doc.md
---
# Add Button Component

A button that opens a dialog for adding a new record to a persisted array.
Renders a Material raised button with an add icon. When clicked, opens an
AddDialog that dynamically loads a schema-driven form for the array's entity type.

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
| array | `PersistedArray<any> \| PersistedFormArray` | Always | The persisted array or form array to add new records to. |
| label | `string` | No | Custom label for the button and dialog title. Defaults to "Add {EntityName}". |
| defaults | `Record<string, any>` | No | Default values for new records. |
| dialogWidth | `string` | No | Custom width for the add dialog. Defaults to '400px'. |

## Outputs

| Name | Type | Description |
|------|------|-------------|
| added | `EventEmitter<any>` | Emits the newly added entity or form group after a successful add. |
