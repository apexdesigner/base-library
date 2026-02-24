# Mixins

A mixin adds reusable properties, relationships, and behaviors to a [business object](business-objects.md). Mixin files are named `<mixin-name>.mixin.ts` and by default are created in `design/mixins/<mixin-name>/`.

## Class

```typescript
// prevent-changes/prevent-changes.mixin.ts

import { Mixin } from "@apexdesigner/dsl";

export class PreventChanges extends Mixin {
}
```

## Properties

Mixins support the same property features as [business objects](business-objects.md#properties):

```typescript
// ...

import { property } from "@apexdesigner/dsl";

export class PreventChanges extends Mixin {
  @property({ hidden: true })
  locked?: boolean;
}
```

## Relationships

Mixins support the same relationship features as [business objects](business-objects.md#relationships):

```typescript
// ...

import { relationship } from "@apexdesigner/dsl";
import { AppUser } from "@business-objects";

export class PreventChanges extends Mixin {
  // ...

  @relationship({ type: "References" })
  lockedBy?: AppUser;
}
```

## Behaviors

Mixins can include [behaviors](behaviors.md) that are inherited by any business object the mixin is applied to. Mixin behavior files are named `<mixin-name>.<behavior-name>.behavior.ts` and by default are created in `design/mixins/<mixin-name>/`.

Mixin behaviors always receive `Model` as the first parameter — a reference to the business object class the mixin is applied to. If the mixin has a [configuration](#configuration), `mixinOptions` is the second parameter. The remaining parameters depend on the behavior type:

| Mixin has config? | Parameters |
|---|---|
| No | `(Model, ...behavior params)` |
| Yes | `(Model, mixinOptions, ...behavior params)` |

### Without Configuration

Instance behavior:

```typescript
// prevent-changes/prevent-changes.unlock.behavior.ts

import { addBehavior } from "@apexdesigner/dsl";
import { PreventChanges } from "@mixins";

addBehavior(
  PreventChanges,
  {
    type: "Instance",
  },
  async function unlock(Model: any, instance: any) {
    instance.locked = false;
    await instance.save();
  },
);
```

Lifecycle behavior:

```typescript
// prevent-changes/prevent-changes.check-locked.behavior.ts

import { addBehavior } from "@apexdesigner/dsl";
import { PreventChanges } from "@mixins";

addBehavior(
  PreventChanges,
  {
    type: "Before Update",
  },
  async function checkLocked(Model: any, where: any, updates: Partial<any>) {
    const instances = await Model.find({ where });
    for (const instance of instances) {
      if (instance.locked) {
        throw new Error("Record is locked and cannot be modified.");
      }
    }
  },
);
```

### With Configuration

Instance behavior:

```typescript
// audit/audit.get-history.behavior.ts

import { addBehavior } from "@apexdesigner/dsl";
import { Audit, AuditConfig } from "@mixins";

addBehavior(
  Audit,
  {
    type: "Instance",
    httpMethod: "Get",
  },
  async function getHistory(Model: any, mixinOptions: AuditConfig, instance: any) {
    return await getAuditHistory(instance, mixinOptions.excludeProperties);
  },
);
```

Lifecycle behavior:

```typescript
// audit/audit.log-changes.behavior.ts

import { addBehavior } from "@apexdesigner/dsl";
import { Audit, AuditConfig } from "@mixins";

addBehavior(
  Audit,
  {
    type: "After Update",
  },
  async function logChanges(Model: any, mixinOptions: AuditConfig, instances: any[]) {
    for (const instance of instances) {
      await logAuditEntry(Model, instance, mixinOptions.excludeProperties);
    }
  },
);
```

All behavior types, endpoint exposure, and role restrictions work the same as [business object behaviors](behaviors.md). See [lifecycle hooks](behaviors.md#lifecycle-hooks) for the parameters that follow `Model` and `mixinOptions`.

## Configuration

Export a config interface to define options for the mixin:

```typescript
import { Mixin } from "@apexdesigner/dsl";

export interface AuditConfig {
  excludeProperties?: string[];
}

export class Audit extends Mixin {
}
```

Configuration is passed when [applying the mixin](business-objects.md#applying-mixins):

```typescript
applyAuditMixin(Student, { excludeProperties: ["created"] });
```

## Testing

Mixin behavior tests work the same as [business object behavior tests](behaviors.md#testing). The `Model` parameter represents whichever business object the mixin is applied to:

```typescript
import { addBehavior, addTest, createTestData } from "@apexdesigner/dsl";
import { PreventChanges } from "@mixins";
import { expect } from "vitest";

addBehavior(
  PreventChanges,
  { type: "Instance" },
  async function unlock(Model: any, instance: any) {
    instance.locked = false;
    await instance.save();
  },
);

addTest("should set locked to false", async () => {
  const instance = await createTestData(Model, { locked: true });

  await instance.unlock();

  const updated = await Model.findById(instance.id);
  expect(updated.locked).toBe(false);
});
```

## Complete Example

```typescript
import { Mixin, property, relationship } from "@apexdesigner/dsl";
import { AppUser } from "@business-objects";

export class PreventChanges extends Mixin {
  @property({ hidden: true })
  locked?: boolean;

  @relationship({ type: "References" })
  lockedBy?: AppUser;
}
```
