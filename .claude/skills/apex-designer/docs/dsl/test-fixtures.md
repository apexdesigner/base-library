# Test Fixtures

A test fixture is a reusable function that creates test data. Fixtures compose across business objects, making complex setup chains explicit and shareable. Test fixture files are named `<name>.<fixture-name>.test-fixture.ts`.

## Business Object Fixtures

Business object fixtures are defined in the business object's directory:

```
design/business-objects/<bo-name>/<bo-name>.<fixture-name>.test-fixture.ts
```

Each file contains a single `addTestFixture` call with a named function:

```typescript
// process-design/process-design.simple-user-task.test-fixture.ts

import { addTestFixture } from "@apexdesigner/dsl";
import { ProcessDesign } from "@business-objects";

addTestFixture(
  ProcessDesign,
  async function simpleUserTask() {
    const design = await ProcessDesign.create({
      name: "Simple User Task",
      version: 1,
      designJson: {
        activities: [
          { id: "start", type: "Start Event", name: "Start" },
          { id: "task", type: "User Task", name: "Review" },
          { id: "end", type: "End Event", name: "End" },
        ],
        flows: [
          { id: "f1", sourceId: "start", targetId: "task" },
          { id: "f2", sourceId: "task", targetId: "end" },
        ],
      },
    });
    return design;
  },
);
```

The function name becomes the method name under `testFixtures`:

```typescript
const design = await ProcessDesign.testFixtures.simpleUserTask();
```

## App Fixtures

App-level fixtures use `addAppTestFixture` and are accessed via `App.testFixtures`:

```typescript
// seed-admin-user.test-fixture.ts

import { addAppTestFixture } from "@apexdesigner/dsl";
import { AppUser } from "@business-objects";

addAppTestFixture(
  async function seedAdminUser() {
    const user = await AppUser.create({
      email: "admin@example.com",
      role: "admin",
    });
    return user;
  },
);
```

```typescript
const admin = await App.testFixtures.seedAdminUser();
```

## Composition

Fixtures can call other fixtures via `BO.testFixtures.name()`:

```typescript
// process-instance/process-instance.started-user-task.test-fixture.ts

import { addTestFixture } from "@apexdesigner/dsl";
import { ProcessDesign, ProcessInstance, Token, UserTask } from "@business-objects";

addTestFixture(
  ProcessInstance,
  async function startedUserTask() {
    const design = await ProcessDesign.testFixtures.simpleUserTask();
    const instance = await ProcessInstance.start({ designId: design.id, wait: 5000 });
    const tokens = await Token.find({
      where: { processInstanceId: instance.id, status: "Active" },
    });
    const userTask = (await UserTask.find({ where: { tokenId: tokens[0].id } }))[0];
    return { design, instance, token: tokens[0], userTask };
  },
);
```

## Usage in Tests

Tests call fixtures directly in [behavior tests](behaviors.md#testing):

```typescript
import { addBehavior, addTest } from "@apexdesigner/dsl";
import { ProcessInstance, UserTask } from "@business-objects";
import { expect } from "vitest";

addBehavior(
  UserTask,
  { type: "Instance" },
  async function complete(instance: UserTask) {
    // ...
  },
);

addTest("should complete process when user task is completed", async () => {
  const { instance, userTask } = await ProcessInstance.testFixtures.startedUserTask();
  await userTask.complete({ wait: 5000 });
  const fetched = await ProcessInstance.findById(instance.id);
  expect(fetched.status).toBe("Complete");
});
```

## Rules

- One `addTestFixture` or `addAppTestFixture` per file
- Must use a named function expression — the name becomes the method name under `testFixtures`
- Can return any value — tests destructure the return value
- Fixture function names must be unique within a business object (enforced by file naming)
