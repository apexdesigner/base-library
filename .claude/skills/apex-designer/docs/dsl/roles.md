# Roles

A role controls access to [business objects](business-objects.md), [behaviors](behaviors.md), and [pages](pages.md). Role files are named `<name>.role.ts` and by default are created in `design/roles/`.

## Class

A role file exports a class that extends `Role`.

```typescript
// administrator.role.ts

import { Role } from "@apexdesigner/dsl";

export class Administrator extends Role {}
```

## Built-in Roles

The DSL provides one built-in role:

- `Everyone` — all users, including unauthenticated.

By default, pages and business objects are accessible to all authenticated users. Specify roles explicitly to restrict access.

## Usage

Roles are used to set [default access](business-objects.md#default-roles) on a business object:

```typescript
import { applyDefaultRoles } from "@apexdesigner/dsl";
import { Administrator, Tutor } from "@roles";

applyDefaultRoles(Student, [Administrator, Tutor]);
```

And to restrict individual [behaviors](behaviors.md#roles):

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
