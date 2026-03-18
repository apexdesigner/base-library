---
generated-from: design/mixins/export-import/is-importing.function.ts
generated-by: design-docs.function.doc.md
---
# Is Importing Function

Returns whether the current request is running within an import context.
Behaviors can check this flag to decide whether to skip side effects
like sending notifications or triggering workflows.

**Layer:** Server

## Output

`boolean` - True if the current request is within an import operation
