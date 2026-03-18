---
generated-from: design/mixins/export-import/export-graph.function.ts
generated-by: design-docs.function.doc.md
---
# Export Graph Function

Traverses the object graph starting from one or more root instances,
collecting children (belongs-to-parent) recursively and referenced
objects with their identifying anchors. Returns a normalized map
suitable for the export file format.

**Layer:** Server

## Inputs

| Name | Type | Description |
|------|------|-------------|
| Model | `any` | The business object class of the root instances |
| instances | `any[]` | The root instances to export |
| mixinOptions | `ExportImportConfig` | Export configuration from the mixin |

## Output

`Promise<{ roots: Record<string, string[]>; objects: Record<string, Record<string, any>> }>` - The roots map and normalized objects map
