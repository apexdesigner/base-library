---
name: apex-designer
description: Apex Designer DSL project workflow. Use when creating or modifying design files, running ad3 commands, or working with the DSL.
---

# Apex Designer

Apex Designer is a low-code platform for building full-stack applications. Projects are defined using a TypeScript DSL in the `/design` directory. The server code (`/server`), client code (`/client`), and documentation (`/docs`) are all generated from the design files and should not be edited directly.

## Design Artifacts

All design artifacts are TypeScript files in the `/design` directory using the Apex Designer DSL. Read the relevant doc before creating or modifying a design type:

| Design Type | Description | Doc |
|---|---|---|
| Business Object | Core entity classes with properties and relationships | `.claude/skills/apex-designer/docs/dsl/business-objects.md` |
| Behavior | Custom logic for business objects | `.claude/skills/apex-designer/docs/dsl/behaviors.md` |
| App Behavior | Application-level server logic | `.claude/skills/apex-designer/docs/dsl/app-behaviors.md` |
| Agent | AI-powered participants for processes | `.claude/skills/apex-designer/docs/dsl/agents.md` |
| Base Type | Type wrappers with validation constraints | `.claude/skills/apex-designer/docs/dsl/base-types.md` |
| Component | Reusable UI elements | `.claude/skills/apex-designer/docs/dsl/components.md` |
| Component Interface | Template API for Angular components | `.claude/skills/apex-designer/docs/dsl/component-interfaces.md` |
| Data Flow | Computation with dependency-based execution | `.claude/skills/apex-designer/docs/dsl/data-flows.md` |
| Data Source | Persistence layer for business objects | `.claude/skills/apex-designer/docs/dsl/data-sources.md` |
| Decision Table | Business rules evaluator | `.claude/skills/apex-designer/docs/dsl/decision-tables.md` |
| Directive Interface | Template API for Angular directives | `.claude/skills/apex-designer/docs/dsl/directive-interfaces.md` |
| External Type | Importable types from libraries | `.claude/skills/apex-designer/docs/dsl/external-types.md` |
| Library Override | Extend library design items | `.claude/skills/apex-designer/docs/dsl/library-overrides.md` |
| Mixin | Reusable properties for business objects | `.claude/skills/apex-designer/docs/dsl/mixins.md` |
| Page | Routable views in the application | `.claude/skills/apex-designer/docs/dsl/pages.md` |
| Persistence | Override default table/storage naming | `.claude/skills/apex-designer/docs/dsl/persistence.md` |
| Pipe Interface | Template pipes for filter syntax | `.claude/skills/apex-designer/docs/dsl/pipe-interfaces.md` |
| Process | Workflow defined as class methods | `.claude/skills/apex-designer/docs/dsl/processes.md` |
| Project | Application settings and dependencies | `.claude/skills/apex-designer/docs/dsl/project.md` |
| Role | Access control for objects and pages | `.claude/skills/apex-designer/docs/dsl/roles.md` |
| Service | Shared injectable logic | `.claude/skills/apex-designer/docs/dsl/services.md` |
| Template | Markup for pages and components | `.claude/skills/apex-designer/docs/dsl/templates.md` |
| Test Fixture | Reusable test data setup functions | `.claude/skills/apex-designer/docs/dsl/test-fixtures.md` |
| Validator | Source file checkers with auto-fix | `.claude/skills/apex-designer/docs/dsl/validators.md` |

## Libraries

Libraries provide reusable design assets, client and server npm packages, and code generators.
Read the library README for available components, patterns, and conventions.
This project includes the following libraries:

- **@apexdesigner/doc-generators** — Design documentation generators for Apex Designer projects (see `design/node_modules/@apexdesigner/doc-generators/README.md`)

If you discover a useful pattern or convention while working with this project, suggest adding it to the library documentation so it can benefit other projects.

If this project is itself a library, see `.claude/skills/apex-designer/docs/library-development.md` for library-specific patterns.

## Workflow

1. Read the relevant doc before creating or modifying a design type
2. Create or edit design files in `design/` — use the Write tool to create new files (it auto-creates directories)
3. A validation hook runs automatically after Edit/Write to `design/` files (via `.claude/skills/apex-designer/scripts/resolve.cjs`) — it checks for errors but does not auto-fix
4. After completing a set of related edits, run `ad3 resolve` to auto-fix issues (adds inverse relationships, foreign keys, etc.) and regenerate code
5. If diagnostics remain after resolve, stop and ask the user for help — do not attempt workarounds
6. `ad3` is installed globally — do not use `npx`
7. After deleting a design file, run `ad3 resolve` manually — the hook only triggers on Edit/Write, not file deletions

### What resolve adds automatically

You don't need to include these in design files — resolve will add them automatically:
- `id` property
- Foreign key properties (e.g., `locationId` for a `location` belongs-to relationship)
- Inverse relationships (e.g., `contacts?: Contact[]` on Location when Contact has `location?: Location`)

`ad3 resolve` handles the full validate/fix/generate cycle, looping until stable. No manual `ad3 gen` steps are needed.

### Static files

Files placed in `design/client/` or `design/server/` are copied into the corresponding generated directory using the same relative path. For example, `design/client/assets/logo.png` is copied to `client/assets/logo.png`. Use this for assets, configuration files, or any file that should be included in the generated output without modification.

## CLI

See `.claude/skills/apex-designer/docs/cli.md` for the full ad3 command reference.

Key commands:
- `ad3 resolve` — validate and auto-fix (includes validation, no need for separate `ad3 val`)
- `ad3 gen` — generate code from design files
- `ad3 stop` / `ad3 start` — manage the ad3 server
- Any ad3 command starts the server if it isn't already running

## Dev Server

See `.claude/skills/apex-designer/docs/dev-sh.md` for usage. The script is at `.claude/skills/apex-designer/scripts/dev.sh` (relative to the project root).

- `bash .claude/skills/apex-designer/scripts/dev.sh` — starts server and client in background, then exits
- `bash .claude/skills/apex-designer/scripts/dev.sh --server-only` — starts only the server (faster, useful for API testing)
- `bash .claude/skills/apex-designer/scripts/dev.sh --stop` — stops all dev processes
- `bash .claude/skills/apex-designer/scripts/dev.sh --debug "AppName:*"` — enables debug output
- Running it again automatically kills existing processes on the ports
- Fire-and-forget: the server uses `tsx --watch` and will auto-restart as files change. If startup fails or times out, check `logs/server.log` and fix the issue (e.g., run `ad3 gen`) — do NOT re-run dev.sh
- Ports can be pinned per project via `.workspace.json`:
  ```json
  { "serverPort": 3000, "clientPort": 4200 }
  ```
  Priority: `.workspace.json` → `PORT`/`CLIENT_PORT` env vars → defaults (3000/4200)
