---
generated-from: design/audit/audit-context-middleware.app-behavior.ts
generated-by: design-docs.app-behavior.doc.md
---
# Audit Context Middleware App Behavior

Wraps each request with an audit AsyncLocalStorage context for passing state between lifecycle hooks.

**Type:** Middleware

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| req | `any` | Yes |  |
| res | `any` | Yes |  |
| next | `() => void` | Yes |  |
