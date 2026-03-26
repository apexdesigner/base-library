---
generated-from: design/user-interfaces/import-tsv/import-tsv-dialog.component.ts
generated-by: design-docs.component.doc.md
---
# Import Tsv Dialog Component

A Material dialog that handles TSV file upload, parsing, column matching,
and importing records into a business object array.

**Type:** Dialog

## Inputs

| Name | Type | Required | Description |
|------|------|----------|-------------|
| array | `PersistedArray<any> \| PersistedFormArray` | Always | The persisted array to import items into. |
| parentObject | `PersistedFormGroup` | No | Parent business object for setting foreign key relationships. |
| customTemplate | `string` | No | Custom TSV template text shown in the dialog. |
| tsvHandler | `(rows: string[][]) => Promise<void>` | No | Custom function to override standard TSV parsing. |
