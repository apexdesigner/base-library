# Before/After Lifecycle Context Coordination

Use `AsyncLocalStorage` to pass state from Before lifecycle hooks to their corresponding After hooks within the same request. This pattern is useful when a Before hook creates a pending record and the After hook needs to complete it with data only available after the operation.

## When to Use

- A Before Create hook records an audit event as "Pending", and the After Create hook marks it "Complete" with the new record's ID
- A Before Update hook captures the old values, and the After Update hook compares them to the new values
- Any case where Before and After hooks for the same lifecycle need to share request-scoped state

## Architecture

Five design artifacts work together:

1. **Interface Definition** — defines the shape of the request-scoped store
2. **App Properties** — holds the `AsyncLocalStorage` instance on the App singleton
3. **Startup Behavior** — initializes the `AsyncLocalStorage` at startup
4. **Middleware** — wraps each request with `context.run({}, () => next())`
5. **Before/After hooks** — write to and read from the store

## Example: Audit Context

The base library's Audit mixin uses this pattern to coordinate pending audit events across Before and After lifecycle hooks.

### 1. Interface Definition

Defines the store shape — a plain object with arrays of pending event IDs.

```typescript
// design/audit/audit-context.interface-definition.ts

import { InterfaceDefinition } from '@apexdesigner/dsl';

export class AuditContext extends InterfaceDefinition {
  pendingCreateIds?: number[];
  pendingUpdateIds?: number[];
  pendingDeleteIds?: number[];
}
```

### 2. App Properties

Holds the `AsyncLocalStorage` instance. The `@property({ hidden: true })` keeps it out of the API.

```typescript
// design/audit/audit-properties.app-properties.ts

import { AppProperties, property } from '@apexdesigner/dsl/app-properties';
import { AuditContext } from '@interface-definitions';
import { AsyncLocalStorage } from 'node:async_hooks';

export class AuditProperties extends AppProperties {
  @property({ hidden: true })
  context?: AsyncLocalStorage<AuditContext>;
}
```

### 3. Startup Behavior

Initializes the `AsyncLocalStorage` instance at startup. Sequence 200 ensures it runs early.

```typescript
// design/audit/setup-audit-context.app-behavior.ts

import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';
import { AsyncLocalStorage } from 'node:async_hooks';

addAppBehavior(
  {
    type: 'Lifecycle Behavior',
    stage: 'Startup',
    sequence: 200,
  },
  async function initAuditContext() {
    App.auditProperties.context = new AsyncLocalStorage();
  },
);
```

### 4. Middleware

Wraps each request with `context.run({}, ...)` so every Before/After hook within the request shares the same store object. Sequence 150 runs after auth middleware (100).

```typescript
// design/audit/audit-context-middleware.app-behavior.ts

import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';

addAppBehavior(
  {
    type: 'Middleware',
    sequence: 150,
  },
  async function auditContextMiddleware(req: any, res: any, next: () => void) {
    App.auditProperties.context!.run({}, () => next());
  },
);
```

### 5. Before Hook (writes to store)

The Before Create hook creates a pending audit event and pushes its ID to the store.

```typescript
// design/audit/audit.record-create-event.behavior.ts

import { addBehavior } from '@apexdesigner/dsl';
import { Audit, AuditConfig } from '@mixins';
import { AuditEvent, User } from '@business-objects';
import { App } from '@app';

addBehavior(
  Audit,
  { type: 'Before Create' },
  async function recordCreateEvent(Model: any, mixinOptions: AuditConfig, dataItems: Partial<any>[]) {
    const currentUser = await User.currentUser();
    const auditCtx = App.auditProperties.context?.getStore() as any;

    for (const model of dataItems) {
      const newEvent = await AuditEvent.create({
        modelName: Model.entityName,
        date: new Date(),
        userEmail: currentUser?.email,
        operation: 'Create',
        dataJson: JSON.stringify(model),
        status: 'Pending',
      });

      if (auditCtx) {
        if (!auditCtx.pendingCreateIds) auditCtx.pendingCreateIds = [];
        auditCtx.pendingCreateIds.push(newEvent.id);
      }
    }
  },
);
```

### 6. After Hook (reads from store)

The After Create hook reads the pending IDs from the store, updates the events with the new record's ID, and clears the array.

```typescript
// design/audit/audit.complete-create-events.behavior.ts

import { addBehavior } from '@apexdesigner/dsl';
import { Audit, AuditConfig } from '@mixins';
import { AuditEvent } from '@business-objects';
import { App } from '@app';

addBehavior(
  Audit,
  { type: 'After Create' },
  async function completeCreateEvents(Model: any, mixinOptions: AuditConfig, instances: any[]) {
    const auditCtx = App.auditProperties.context?.getStore() as any;

    if (auditCtx?.pendingCreateIds?.length) {
      const modelId = instances[0]?.id;
      await AuditEvent.update(
        { where: { id: { in: auditCtx.pendingCreateIds } } },
        { modelId, status: 'Complete' },
      );
      auditCtx.pendingCreateIds = [];
    }
  },
);
```

## Key Details

| Concern | Detail |
|---|---|
| Middleware must be a separate file | The generator only picks up one `addAppBehavior` per file |
| Middleware sequence | Must run after auth middleware (100) so the auth context is available |
| Startup sequence | Must run before the middleware registers |
| Multiple contexts can coexist | Each `AsyncLocalStorage` instance is independent (e.g., auth context + audit context) |
| Store is a plain object | Before hooks add properties, After hooks read and clear them |
| Background workers | Have no request context — `getStore()` returns `undefined`, so hooks should guard with `if (auditCtx)` |

## Applying the Pattern to Your Own Feature

1. Create an interface definition for your store shape
2. Create app properties with an `AsyncLocalStorage` field typed to your interface
3. Create a startup behavior to initialize the `AsyncLocalStorage`
4. Create a middleware to wrap requests with `context.run({}, ...)`
5. In Before hooks, write to the store via `App.yourProperties.context?.getStore()`
6. In After hooks, read from the store and clear the values

---

[← Back to Patterns](./README.md)
