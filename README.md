# @apexdesigner/base-library

Base scaffold and code generators for Apex Designer Angular/Express applications. Generates full-stack Angular + Express applications from Apex Designer DSL files.

## Client-Side

- **Angular 19** application scaffold with Material Design
- **Layout components** — `flex-row`, `flex-column`, `grow`, `scroll`. See `client/node_modules/@apexdesigner/flex-layout/README.md`
- **Data tables** — `dt-table`, `dt-column` with routing, formatting, and state management. See `client/node_modules/@apexdesigner/declarative-tables/README.md`
- **Schema-driven forms** — `sf-fields`, `sf-field` with auto-rendering based on business object schemas. See `client/node_modules/@apexdesigner/schema-forms/README.md`
- **Generated types** for each business object: `FormGroup` (single record), `PersistedArray` (API-backed list), `FormArray` (inline editing)

## Server-Side

- **Express 5** application scaffold with REST API routes
- **Schema-first persistence** with Postgres support. See `server/node_modules/@apexdesigner/schema-persistence/README.md`
- **Generated model classes** with static methods (`find`, `findById`, `create`, `createMany`, `count`) and instance methods (`save`, `delete`)
- **Zod schemas** with UI metadata extensions. See `client/node_modules/@apexdesigner/schema-tools/README.md`

## Patterns

- [**Generated Types**](./docs/patterns/generated-types.md) - Typed classes produced for each business object
- [**List + Detail Page Pair**](./docs/patterns/list-detail-pages.md) - The most common page structure
- [**Dialog Components**](./docs/patterns/dialog-components.md) - Modal dialogs with inputs, outputs, and programmatic open/close
- [**Client-Side Debug**](./docs/patterns/client-side-debug.md) - Conditional logging in components, pages, and services
- [**Server-Side Debug**](./docs/patterns/server-side-debug.md) - Conditional logging in behaviors and app behaviors
- [**Seeding Test Data**](./docs/patterns/seeding-test-data.md) - Server-side lifecycle logic for seeding data
