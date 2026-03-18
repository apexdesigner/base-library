---
generated-from: design/mixins/export-import/set-importing.function.ts
generated-by: design-docs.function.doc.md
---
# Set Importing Function

Runs a callback within an import context. Behaviors can check
isImporting() to decide whether to skip side effects like
sending notifications or triggering workflows.

**Layer:** Server

## Inputs

| Name | Type | Description |
|------|------|-------------|
| callback | `() => Promise<T>` | The function to run within the import context |

## Output

`Promise<T>` - The return value of the callback
