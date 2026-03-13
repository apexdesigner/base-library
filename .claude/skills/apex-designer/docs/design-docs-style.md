# Design Documentation Style Guide

Style conventions for concept-level markdown files in `/design`.

## Purpose

Each concept directory has a markdown file (e.g., `process-design/process-design.md`) that documents the design assets in that directory. These docs are biased toward library consumers but should also cover what library developers need.

## Structure

### Heading

Every markdown file in `/design` must start with an `# H1` heading — the concept name or directory purpose.

### Opening

For directories with a primary business object, start with it as a sentence. Link to the `.business-object.ts` file and include the DSL type after the link. Follow with sentences that explain what it is and what you can do with it.

```markdown
A [Process Instance](process-instance.business-object.ts) business object is a running execution of a [process design](../process-design/process-design.md).
```

For directories without a primary business object (engine, libraries, admin, shared), start with a plain sentence about the directory's purpose:

```markdown
The engine provides core runtime services used across the process engine.
```

### Sections

Organize by what the reader needs to understand, not by DSL type. Good section names describe concepts (Loading, Lifecycle, State Update) rather than artifacts (Behaviors, Base Types, Business Objects).

Put consumer-facing sections first (starting, lifecycle, data operations). Put implementation details later (state update internals, upload pipeline). Put reference sections last (user interface, views, history, test fixtures).

### Prose over lists

Write sentences and paragraphs, not bullet lists. Each sentence introduces a design artifact with an inline link and explains what it does. Use bullet lists only for reference sections like test fixtures where items are parallel and self-contained.

```markdown
The [start](behaviors/process-instance.start.behavior.ts) behavior creates a new instance from a process design ID, places an initial token at the start event, and optionally waits for the instance to reach a stable state.
```

### Links

Every design artifact gets a relative link to its file on first mention. Include the DSL type after the link text to help the reader understand what kind of artifact it is:

- `[Process Instance](process-instance.business-object.ts) business object` — for business objects
- `[start](behaviors/process-instance.start.behavior.ts) behavior` — for behaviors
- `[process instance status](process-instance-status.base-type.ts) base type` — for base types
- `[process instances](user-interface/process-instances.page.ts) page` — for pages
- `[update data](user-interface/update-data-button.component.ts) button` — for components

Link only the first mention of each artifact. Subsequent references use plain text.

Cross-link to other concept directories when referencing their artifacts. Link to the concept doc when introducing the concept, or to the specific file when referencing a particular artifact:

```markdown
a running execution of a [process design](../process-design/process-design.md)
places an initial [token](../token/token.business-object.ts) at the start event
```

Again, only on first mention. After that, just say "token."

### Avoid

- Code-style references like `ProcessDesign.upload()` — prefer prose with links
- Implementation details like SQL dialect or specific algorithms — keep in the source
- DSL type headings like "## Behaviors" or "## Base Types" — organize by concept instead
- Repeating links to the same artifact — link once, then use plain text

### Status base types

Describe a status base type inline with its values:

```markdown
A user task has a status with values from the [user task status](user-task-status.base-type.ts) base type (Active, Paused, Complete, Canceled).
```

### Button and dialog components

Describe buttons and their associated dialogs together:

```markdown
The [update data](user-interface/update-data-button.component.ts) button and associated [dialog](user-interface/update-data-dialog.component.ts) allow editing the instance data payload.
```

### Test fixtures

Use a bullet list where each item is a sentence:

```markdown
- [Simple start end](test-fixtures/process-design.simple-start-end.test-fixture.ts) has just a start and end event.
- [Simple user task](test-fixtures/process-design.simple-user-task.test-fixture.ts) adds a single user task between start and end.
```

### Libraries

The libraries doc lists each design dependency in the order they appear in `project.ts`. Each section links to the library's docs in `node_modules` and describes any refinements this project makes:

```markdown
The [@apexdesigner/base-library](../node_modules/@apexdesigner/base-library/docs/design/README.md) provides authentication, roles, users, and shared UI components.

The [Role](role/role.business-object.ts) business object adds relationships to user tasks so that tasks can be scoped to specific roles.
```

## Top-level design.md

The root `design/design.md` file provides a map of all concept directories. It follows the same prose style, introducing each concept with a sentence and linking to the concept's markdown file or key artifacts.
