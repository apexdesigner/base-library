---
generated-from: design/user-interfaces/import-tsv/import-tsv-button.component.ts
generated-by: design-docs.component.doc.md
---
# Import Tsv Button Component

An icon button that opens a dialog for importing tab-separated values
into a business object array.

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
| array | `PersistedArray<any> \| PersistedFormArray` | Always | The persisted array to import items into. |
| parentObject | `PersistedFormGroup` | No | Parent business object for setting foreign key relationships. |
| customTemplate | `string` | No | Custom TSV template for the import dialog. |
| tsvHandler | `(rows: string[][]) => Promise<void>` | No | Custom function to override standard TSV parsing. |
