# Interface Definitions

An interface definition is a non-persisted data shape — a name and a set of properties with no table, no CRUD, and no relationships. Interface definition files are named `<name>.interface-definition.ts` and by default are created in `design/interface-definitions/<name>/`.

## Class

An interface definition exports a class that extends `InterfaceDefinition`:

```typescript
// address/address.interface-definition.ts

import { InterfaceDefinition } from "@apexdesigner/dsl";

export class Address extends InterfaceDefinition {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}
```

## Properties

Properties work the same as on [business objects](business-objects.md#properties) — native types and [base types](base-types.md) are supported:

```typescript
import { InterfaceDefinition } from "@apexdesigner/dsl";
import { Email } from "@base-types";

export class ContactInfo extends InterfaceDefinition {
  name?: string;
  email?: Email;
  phone?: string;
}
```

Use `@property()` when modifiers are needed:

```typescript
import { InterfaceDefinition, property } from "@apexdesigner/dsl";

export class Address extends InterfaceDefinition {
  @property({ required: true })
  street?: string;

  @property({ required: true })
  city?: string;

  @property({ required: true, displayName: "State / Province" })
  state?: string;

  @property({ required: true })
  zip?: string;
}
```

Available options:

| Option | Type | Description |
|---|---|---|
| `required` | `boolean` | Whether the property is required |
| `hidden` | `boolean` | Whether the property is hidden in UI |
| `disabled` | `boolean` | Whether the property is disabled in UI |
| `displayName` | `string` | Display label |
| `placeholder` | `string` | Placeholder text |
| `helpText` | `string` | Help text |
| `presentAs` | `string` | UI presentation hint (e.g. `"textarea"`) |
| `requiredWhen` | `ConditionalRule` | Conditional required rule |
| `excludeWhen` | `ConditionalRule` | Conditional exclude rule |
| `disabledWhen` | `ConditionalRule` | Conditional disabled rule |

## Nesting

An interface definition can reference other interface definitions. There is no depth limit:

```typescript
import { InterfaceDefinition } from "@apexdesigner/dsl";
import { GeoPoint } from "@interface-definitions";

export class Address extends InterfaceDefinition {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  coordinates?: GeoPoint;
}
```

```typescript
// geo-point/geo-point.interface-definition.ts

import { InterfaceDefinition } from "@apexdesigner/dsl";

export class GeoPoint extends InterfaceDefinition {
  latitude?: number;
  longitude?: number;
}
```

## Behavior Input

Interface definitions give typed parameters to [behaviors](behaviors.md):

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";
import { EnrollmentRequest } from "@interface-definitions";

addBehavior(
  Student,
  {
    type: "Class",
    httpMethod: "Post",
  },
  async function enroll(body: EnrollmentRequest) {
    // body is typed as EnrollmentRequest
  },
);
```

```typescript
// enrollment-request/enrollment-request.interface-definition.ts

import { InterfaceDefinition, property } from "@apexdesigner/dsl";

export class EnrollmentRequest extends InterfaceDefinition {
  @property({ required: true })
  firstName?: string;

  @property({ required: true })
  lastName?: string;

  @property({ required: true })
  gradeLevel?: number;

  notes?: string;
}
```

## Behavior Output

Interface definitions also type behavior return values:

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { Student } from "@business-objects";
import { DashboardSummary } from "@interface-definitions";

addBehavior(
  Student,
  {
    type: "Class",
    httpMethod: "Get",
  },
  async function dashboard(): Promise<DashboardSummary> {
    return {
      totalStudents: await Student.count(),
      activeStudents: await Student.count({ where: { status: "active" } }),
    };
  },
);
```

```typescript
// dashboard-summary/dashboard-summary.interface-definition.ts

import { InterfaceDefinition } from "@apexdesigner/dsl";

export class DashboardSummary extends InterfaceDefinition {
  totalStudents?: number;
  activeStudents?: number;
}
```

## Embedded on a Business Object

When a business object property is typed as an interface definition, it is implicitly embedded — no `@relationship()` decorator is needed. Both single objects and arrays are supported:

```typescript
import { BusinessObject } from "@apexdesigner/dsl";
import { Address, PhoneNumber } from "@interface-definitions";

export class Student extends BusinessObject {
  // ...

  address?: Address;
  phoneNumbers?: PhoneNumber[];
}
```
