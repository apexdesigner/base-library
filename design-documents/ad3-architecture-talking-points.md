# AD3 Technical Architecture — Talking Points

## 1. Design-First Architecture

- Everything is defined in TypeScript DSL files in a `/design` directory
- The DSL uses TypeScript classes, decorators, and functions — not config files, YAML, or a custom language
- Developers get full IDE support: autocomplete, type checking, refactoring
- Generated code (server, client, docs) is never edited directly — it's an output, not a source
- Static files in `design/client/` and `design/server/` provide an escape hatch for things the DSL doesn't cover yet

## 2. Design Types

The DSL vocabulary — each type maps to a TypeScript file pattern:

**Data layer:**
- **Business Object** — core entity with properties, relationships, and CRUD
- **Behavior** — custom logic attached to a business object (instance or class level, API endpoints)
- **Data Source** — persistence configuration (Postgres, etc.)
- **Mixin** — reusable property sets shared across business objects
- **Interface Definition** — non-persisted data shapes for typed parameters

**Server:**
- **App Behavior** — application-level logic: API endpoints, middleware, lifecycle hooks, event handlers
- **App Properties** — server-side singleton state (caches, clients, config)

**Client:**
- **Component** — reusable UI element
- **Page** — routable view
- **Service** — shared injectable logic (auth, state management)
- **Template** — markup for pages and components

**Cross-cutting:**
- **Role** — access control for objects and pages
- **External Type** — imports from third-party libraries
- **Base Type** — type wrappers with validation constraints
- **Project** — application settings, dependencies, configuration

**Advanced:**
- **Process** — workflow defined as class methods with service tasks
- **Agent** — AI-powered participants for processes
- **Decision Table** — business rules evaluator
- **Data Flow** — computation with dependency-based execution
- **Test Fixture** — reusable test data setup functions
- **Validator** — custom source file checkers with auto-fix

## 3. Module Structure (The Server)

AD3 runs as a lightweight daemon that watches design files and provides an HTTP API to the CLI. The major modules:

- **Loader** — reads design files and extracts metadata from the TypeScript AST using ts-morph. Each file produces a metadata object with type, name, source file, and parsed properties.
- **Cache** — in-memory store of all design metadata. Provides fast lookup by type, name, and relationships. Rebuilt on file changes.
- **Validation** — checks design files for structural errors and auto-fixes common issues (adds inverse relationships, foreign keys, id properties). Runs in a loop until stable.
- **Building Blocks** — orchestration layer that composes the lower-level modules. Coordinates validate → generate cycles, manages package installation, and handles interface extraction.
- **Watcher** — chokidar-based file watcher. Detects design file changes and triggers incremental reload of affected metadata.
- **Writer** — writes generated output files to disk. Handles diffing to avoid unnecessary writes and manages static file overrides.
- **Packages** — manages npm dependencies for client and server subprojects. Reads `clientDependencies`/`serverDependencies` from project.ts and syncs package.json files.
- **Server** — Express HTTP server that the CLI (`ad3`) communicates with. Provides endpoints for commands like list, generate, validate, resolve.
- **Routes** — API endpoint handlers: list objects, trigger generation, run validation, extract schemas, manage dependencies.

The resolve cycle: **load → validate → auto-fix → generate → repeat until stable**

## 4. Code Generation Pipeline

### Generators

- Each generator is a module with `name`, `triggers`, `outputs`, and a `generate` function
- **Triggers** define which design types activate the generator (e.g., `metadataType: 'BusinessObject'`)
- **Outputs** declare the file paths the generator will write
- **Per-item generators** run once per matching design object (e.g., one component file per Component)
- **Aggregate generators** run once across all matching objects (e.g., role-definitions collects all Roles into one file)

### The resolve cycle

1. Load all design files → extract metadata
2. Run validators → detect issues
3. Auto-fix (add inverse relationships, foreign keys, etc.)
4. Run generators → produce output files
5. If fixes changed design files, loop back to step 1
6. Repeat until stable (no more fixes needed)

### Generator architecture

- Generators live in library packages (e.g., `base-library/generators/`)
- Projects inherit generators from their library dependencies
- Generators receive metadata and a generation context with access to all design objects
- Output is a string (file content) — the framework handles writing, diffing, and conflict detection

## 5. Type System

Generated type definitions keep the DSL type-safe:

- **`@business-objects`** — server-side BO types with full CRUD methods and typed filters
- **`@business-objects-client`** — client-side BO types (same methods, different runtime)
- **`@services`** — service types with properties and methods
- **`@app`** — App singleton with app properties
- **`@interface-definitions`** — interface definition types
- **`@pages`**, **`@components`**, **`@external-types`** — other design type references

These are generated as `.d.ts` files so design files can import from them and get full type checking. When a business object gains a new property, the type updates automatically on the next resolve.

## 6. Libraries

Libraries are reusable packages that provide:

- **Design assets** — business objects, services, components, pages, roles that projects inherit
- **Generators** — code generators that produce output from design metadata
- **Client/server npm packages** — runtime code consumed by generated apps
- **Parameter values** — configurable defaults that consuming projects can override

A library is just a project with `isLibrary = true`. Projects declare library dependencies in `designDependencies` and inherit everything. Design types load application-first, then from each dependency in order.

Library overrides let a consuming project extend or modify inherited design items without forking the library.

## 7. Server Architecture (Generated App)

The generated server is Express-based:

- **Middleware** — ordered pipeline (sequence 0-999) for auth, CORS, validation, etc.
- **Lifecycle behaviors** — startup (sequence 1-999), running, shutdown stages
- **App properties** — singleton state on the `App` object (caches, clients, config)
- **API endpoints** — auto-generated CRUD routes for business objects + custom behaviors
- **Role-based access** — routes protected by role definitions, enforced by middleware
- **Data sources** — pluggable persistence (Postgres via schema-persistence)

Request flow: middleware pipeline → role check → route handler → business object CRUD or behavior

## 8. Client Architecture (Generated App)

The generated client is Angular-based:

- **Pages** — routable views with role-based access, automatic route generation
- **Components** — reusable UI elements with component interfaces for template APIs
- **Services** — injectable singletons with `callOnLoad` initialization
- **Templates** — Angular templates with data binding
- **Static files** — escape hatch for guards, interceptors, providers (until DSL covers them)

The framework generates the Angular module structure, routing, and DI wiring from the design files.

## 9. Extensibility

Multiple extension points for libraries and projects:

- **Custom generators** — add new code generation targets
- **Custom validators** — enforce project-specific rules with auto-fix
- **External types** — bring in third-party library types for use in the DSL
- **Library overrides** — extend inherited design items
- **Parameter values** — configurable values that flow from library to project
- **Static files** — direct file placement for anything the DSL doesn't model yet
- **Package providers** — register Angular library providers at bootstrap via project.ts
