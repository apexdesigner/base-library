# Overview

Design files live in the `design/` directory and are written in TypeScript.

## Design Types

- [Business Objects](business-objects.md) — data models with properties, relationships, and behaviors
- [Interface Definitions](interface-definitions.md) — non-persisted data shapes for behavior input/output and embedded data
- [Base Types](base-types.md) — reusable property types with validation and constrained values
- [Mixins](mixins.md) — reusable properties, relationships, and behaviors applied to business objects
- [Behaviors](behaviors.md) — custom logic attached to business objects
- [App Behaviors](app-behaviors.md) — application-level server logic
- [Agents](agents.md) — AI-powered participants for processes
- [Data Flows](data-flows.md) — computations and transformations as dependency graphs
- [Processes](processes.md) — workflows with activities, gateways, and events
- [Decision Tables](decision-tables.md) — DMN-based business rules with hit policies
- [Data Sources](data-sources.md) — persistence layer configuration
- [Pages](pages.md) — routable views in the application
- [Components](components.md) — reusable UI elements
- [Services](services.md) — shared injectable logic
- [Templates](templates.md) — markup and control flow for pages and components
- [Component Interfaces](component-interfaces.md) — template API for components with element selectors (auto-generated)
- [Directive Interfaces](directive-interfaces.md) — template API for attribute directives (auto-generated)
- [Pipe Interfaces](pipe-interfaces.md) — template pipes (auto-generated)
- [External Types](external-types.md) — injectable services and importable types (auto-generated)
- [Test Fixtures](test-fixtures.md) — reusable test data setup functions
- [Roles](roles.md) — access control definitions
- [Project](project.md) — application settings and dependencies
- [Validators](validators.md) — design source checks and auto-fixes
- [Persistence](persistence.md) — overrides for tables, columns, indexes, and views

## Documentation

Use JSDoc comments to provide a display name and description for any design type:

```typescript
/**
 * PostgreSQL Database
 *
 * Primary PostgreSQL database for production data.
 */
export class Postgres extends DataSource {}
```

The first line is used as the display name. The remaining text is used as the description.
