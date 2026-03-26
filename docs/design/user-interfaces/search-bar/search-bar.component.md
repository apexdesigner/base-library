---
generated-from: design/user-interfaces/search-bar/search-bar.component.ts
generated-by: design-docs.component.doc.md
---
# Search Bar Component

A text input that filters a business object array by searching across all
string properties. Applies a debounced server-side ilike filter.

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
| array | `PersistedArray<any> \| PersistedFormArray` | Always | The persisted array to filter. |
