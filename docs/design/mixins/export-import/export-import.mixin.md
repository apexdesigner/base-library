---
generated-from: design/mixins/export-import/export-import.mixin.ts
generated-by: design-docs.mixin.doc.md
---
# Export Import Mixin

Adds portable JSON export and import to any business object.

## Behaviors

| Name | Type | Method | Description |
|------|------|--------|-------------|
| [exportInstance](export-import.export-instance.behavior.md) | Instance | Get | Exports a single business object instance with its full object graph as a portable JSON document. |
| [exportMany](export-import.export-many.behavior.md) | Class | Post | Exports every instance matching a where filter, combining them into a single portable JSON document with deduplicated references. |
