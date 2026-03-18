---
generated-from: design/auth/middleware/set-system-request.function.ts
generated-by: design-docs.function.doc.md
---
# Set System Request Function

Runs a callback within a system request context where
role checking is bypassed. The context is scoped to the
callback and does not affect other concurrent requests.

**Layer:** Server

## Inputs

| Name | Type | Description |
|------|------|-------------|
| callback | `() => Promise<T>` | The function to run as a system request |

## Output

`Promise<T>` - The return value of the callback
