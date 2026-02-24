# Seeding Test Data

Use app behaviors for server-side lifecycle logic like seeding data:

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";
import createDebug from "debug";
import { Supplier } from "@business-objects";

const debug = createDebug("MyApp:AppBehavior:seedData");

addAppBehavior(
  {
    type: "Lifecycle Behavior",
    lifecycleStage: "After Start",
  },
  async function seedData() {
    const count = await Supplier.count();
    if (count > 0) return;

    await Supplier.createMany([
      { name: "Acme Corp", code: "ACME" },
      { name: "Global Inc", code: "GLOB" },
    ]);
    debug("seeded suppliers");
  },
);
```

- `lifecycleStage: "After Start"` runs after the server starts listening
- Always check if data exists before seeding to avoid duplicates
- Use the `debug` package for logging (not `console.log`)

---

[← Back to Patterns](./README.md)
