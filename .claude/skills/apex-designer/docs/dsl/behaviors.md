# Behaviors

A behavior adds custom logic to a [business object](business-objects.md). Behavior files are named `<business-object-name>.<behavior-name>.behavior.ts` and by default are created in `design/business-objects/<business-object-name>/`.

## Structure

A behavior file calls `addBehavior()` with the business object, options, and a named function. The behavior name is taken from the function name.

```typescript
// student/student.set-defaults.behavior.ts

import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";

addBehavior(
  Student,
  {
    type: "Before Create",
  },
  async function setDefaults(dataItems: Partial<Student>[]) {
    for (const dataItem of dataItems) {
      if (!dataItem.created) {
        dataItem.created = new Date();
      }
    }
  },
);
```

Use `name` in the options when a behavior name is a reserved word:

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";

addBehavior(
  Student,
  {
    name: "export",
    type: "Instance",
    httpMethod: "Post",
  },
  async function exportBehavior(student: Student, options: any) {
    // ...
  },
);
```

## Instance Methods

Instance methods operate on a single record:

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";

addBehavior(
  Student,
  {
    type: "Instance",
  },
  async function getLinkedResources(student: Student) {
    // ...
  },
);
```

## Class Methods

Class methods operate on the business object class:

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";

addBehavior(
  Student,
  {
    type: "Class",
  },
  async function active(options: any) {
    // ...
  },
);
```

Use [interface definitions](interface-definitions.md) to type inputs and outputs:

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";
import { TranscriptRequest, TranscriptReport } from "@interface-definitions";

addBehavior(
  Student,
  {
    type: "Instance",
    httpMethod: "Post",
  },
  async function generateTranscript(student: Student, body: TranscriptRequest): Promise<TranscriptReport> {
    // ...
  },
);
```

## Exposing Endpoints

Instance and class behaviors can be exposed as API endpoints using `httpMethod`.

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";

addBehavior(
  Student,
  {
    name: "export",
    type: "Instance",
    httpMethod: "Post",
  },
  async function exportBehavior(student: Student, options: any) {
    // ...
  },
);
```

Paths default to `/api/<plural-kebab-name>/<id>/<kebab-behavior-name>` for instance behaviors and `/api/<plural-kebab-name>/<kebab-behavior-name>` for class behaviors. Use `path` to override:

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";

addBehavior(
  Student,
  {
    type: "Class",
    httpMethod: "Get",
    path: "/api/active-students/:organizationId",
  },
  async function active(organizationId: number, options: any) {
    // ...
  },
);
```

Available HTTP methods: `"Get"`, `"Post"`, `"Patch"`, `"Put"`, `"Delete"`.

## Lifecycle Hooks

Lifecycle hooks run before or after create, update, delete, and read operations. Each hook type has a fixed input pattern:

| Type | Parameters | Description |
|------|-----------|-------------|
| `"Before Create"` | `(dataItems: Partial<T>[])` | Partials without IDs yet |
| `"After Create"` | `(instances: T[])` | Full instances with IDs |
| `"Before Update"` | `(where: any, updates: Partial<T>)` | Filter criteria + changes to apply |
| `"After Update"` | `(instances: T[])` | Instances reflecting applied changes |
| `"Before Delete"` | `(where: any)` | Filter criteria for what to delete |
| `"After Delete"` | `(instances: T[])` | Instances that were deleted |
| `"Before Read"` | `(where: any)` | Filter criteria for what to read |
| `"After Read"` | `(instances: T[])` | Instances that were read |
| `"After Start"` | _(none)_ | Server startup hook |

### Before Create

Set defaults or validate data before records are created:

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";

addBehavior(
  Student,
  {
    type: "Before Create",
  },
  async function setDefaults(dataItems: Partial<Student>[]) {
    for (const dataItem of dataItems) {
      if (!dataItem.created) {
        dataItem.created = new Date();
      }
    }
  },
);
```

### After Create

Perform side effects after records are created:

```typescript
addBehavior(
  Student,
  {
    type: "After Create",
  },
  async function sendWelcome(instances: Student[]) {
    for (const instance of instances) {
      await sendWelcomeEmail(instance.email);
    }
  },
);
```

### Before Update

Validate or modify updates before they are applied:

```typescript
addBehavior(
  Student,
  {
    type: "Before Update",
  },
  async function validateUpdate(where: any, updates: Partial<Student>) {
    if (updates.status === "graduated" && !updates.graduationDate) {
      updates.graduationDate = new Date();
    }
  },
);
```

### After Update

Perform side effects after records are updated:

```typescript
addBehavior(
  Student,
  {
    type: "After Update",
  },
  async function notifyChanges(instances: Student[]) {
    for (const instance of instances) {
      await notifyAdvisor(instance);
    }
  },
);
```

### Before Delete

Validate or prevent deletion:

```typescript
addBehavior(
  Student,
  {
    type: "Before Delete",
  },
  async function preventActiveDelete(where: any) {
    // Validate or modify the where clause before deletion
  },
);
```

### After Delete

Clean up related data after records are deleted:

```typescript
addBehavior(
  Student,
  {
    type: "After Delete",
  },
  async function cleanupFiles(instances: Student[]) {
    for (const instance of instances) {
      await deleteStudentFiles(instance.id);
    }
  },
);
```

## Roles

By default, behaviors follow the [default roles](business-objects.md#default-roles) of the business object. Use `roles` to restrict a behavior to specific [roles](roles.md):

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";
import { Administrator, CurriculumDeveloper } from "@roles";

addBehavior(
  Student,
  {
    type: "Instance",
    httpMethod: "Get",
    roles: [Administrator, CurriculumDeveloper],
  },
  async function getLinkedResources(student: Student) {
    // ...
  },
);
```

## Testing

Use `addTest()` in a behavior file to define tests for the behavior. Tests use [test fixtures](test-fixtures.md) and CRUD APIs to set up data, with vitest assertions:

```typescript
// student/student.set-defaults.behavior.ts

import { addBehavior, addTest } from "@apexdesigner/dsl";
import { Student } from "@business-objects";
import { expect } from "vitest";

addBehavior(
  Student,
  {
    type: "Before Create",
  },
  async function setDefaults(dataItems: Partial<Student>[]) {
    for (const dataItem of dataItems) {
      if (!dataItem.created) {
        dataItem.created = new Date();
      }
    }
  },
);

addTest("should set created date when not provided", async () => {
  const student = await Student.testFixtures.simple();
  expect(student.created).toBeDefined();
});

addTest("should preserve existing created date", async () => {
  const date = new Date("2025-01-01");
  const student = await Student.create({ firstName: "Jane", created: date });
  expect(student.created).toEqual(date);
});
```
