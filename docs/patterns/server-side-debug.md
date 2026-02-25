# Server-Side Debug

Use the `debug` npm package for conditional logging in behaviors and app behaviors. Debug output only appears when the `DEBUG` environment variable is set — no performance cost in production.

## DSL Design File

### Behaviors

```typescript
import createDebug from "debug";
import { addBehavior } from "@apexdesigner/dsl";
import { ProcessDesign, ProcessDesignHistory } from "@business-objects";

const debug = createDebug("ProcessEngine:ProcessDesign:disable");

addBehavior(
  ProcessDesign,
  {
    type: "Instance",
    httpMethod: "Post",
  },
  async function disable(processDesign: ProcessDesign) {
    debug("processDesign.id %j", processDesign.id);

    await ProcessDesign.updateById(processDesign.id, { suspended: true });

    await ProcessDesignHistory.create({
      processDesignId: processDesign.id,
      eventType: "Suspended",
      timestamp: new Date(),
    });
  },
);
```

### App Behaviors

```typescript
import createDebug from "debug";
import { addAppBehavior } from "@apexdesigner/dsl";
import { App } from "@project";

const debug = createDebug("ProcessEngine:App:loadSampleDesigns");

addAppBehavior(
  {
    type: "Class Behavior",
  },
  async function loadSampleDesigns() {
    debug("starting");

    // ...
  },
);
```

## Key Differences from Client-Side

- **Always use `%j`** — there's no browser console to inspect objects; `%j` serializes to JSON in terminal output
- **Namespace includes app name** — `AppName:ClassName:methodName` for behaviors, `AppName:App:methodName` for app behaviors
- **Use lowercase `debug`** in the design file — the generator renames it to `Debug` and injects `const debug = Debug.extend("methodName")` per behavior method

## Namespace Convention

```
AppName:ClassName:methodName
```

| Design Type | Example |
|---|---|
| Behavior | `ProcessEngine:ProcessDesign:disable` |
| App Behavior | `ProcessEngine:App:evaluateCondition` |
| Mixin Behavior | `ProcessEngine:LastModified:setCreatedAt` |

## What Gets Generated

The generator transforms your behavior code and adds debug to all built-in CRUD methods automatically:

```typescript
const Debug = createDebug("ProcessEngine:BusinessObject:ProcessDesign");

// Built-in methods get debug automatically:
static async find(filter?: any) {
  const debug = Debug.extend("find");
  debug("filter %j", filter);
  // ...
  debug("results.length %j", results.length);
}

// Your behavior methods get Debug.extend injected:
async disable() {
  const debug = Debug.extend("disable");
  debug("processDesign.id %j", this.id);
  // ...
}
```

## Enabling Debug Output

```bash
# Full namespace
DEBUG=ProcessEngine:ProcessDesign:disable node app.js

# Wildcard — often sufficient
DEBUG=*disable* node app.js
DEBUG=*ProcessDesign* node app.js

# All app debug output
DEBUG=ProcessEngine:* node app.js

# Multiple patterns
DEBUG=ProcessEngine:ProcessDesign:*,ProcessEngine:Token:* node app.js
```

## Debug in Tests

Use `debug()` in `addTest` blocks — it uses the same namespace as the behavior:

```typescript
addTest("should set suspended to true", async () => {
  const design = await ProcessDesign.testFixtures.simpleStartEnd();
  debug("design.id %j", design.id);

  await design.disable();

  const updated = await ProcessDesign.findById(design.id);
  debug("updated.suspended %j", updated.suspended);

  expect(updated.suspended).toBe(true);
});
```

Run tests with debug output:

```bash
bash .claude/skills/debug/scripts/debug-test.sh '*ProcessDesign*' -- src/process-design.spec.ts
```

---

[← Back to Patterns](./README.md)
