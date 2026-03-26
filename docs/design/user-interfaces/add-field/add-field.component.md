---
generated-from: design/user-interfaces/add-field/add-field.component.ts
generated-by: design-docs.component.doc.md
---
# Add Field Component

An inline text input for adding a new item to a business object array.
Types a name, presses Enter, and the item is created with that name as
its first visible property.

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
| array | `PersistedArray<any> \| PersistedFormArray` | Always | The persisted array to add items to. |
| label | `string` | No | Placeholder/label for the input field. |
| defaults | `Record<string, any>` | No | Default property values for new items. |
| nameCase | `string` | No | Case transformation before saving (e.g., 'capitalCase'). |

## Outputs

| Name | Type | Description |
|------|------|-------------|
| added | `EventEmitter<any>` | Emitted with the newly created item. |
