# Business Objects

A business object is a class that extends `BusinessObject`. Business object files are named `<name>.business-object.ts` and by default are created in `design/business-objects/<name>/`.

## Class

```typescript
// student/student.business-object.ts

import { BusinessObject } from "@apexdesigner/dsl";

export class Student extends BusinessObject {
}
```

## Properties

Properties are type annotations. Native types (`string`, `number`, `boolean`) are used directly.

```typescript
// ...

export class Student extends BusinessObject {
  firstName?: string;
  lastName?: string;
}
```

[Base types](base-types.md) add validation, constrained values, or design-specific semantics. They are imported from `@base-types`.

```typescript
// ...

import { DateWithoutTime, Email, GradeLevel } from "@base-types";

export class Student extends BusinessObject {
  // ...

  email?: Email;
  dateOfBirth?: DateWithoutTime;
  currentGradeLevel?: GradeLevel;
}
```

Use `@property()` when modifiers are needed:

```typescript
// ...

import { property } from "@apexdesigner/dsl";

export class Student extends BusinessObject {
  // ...

  @property({ hidden: true })
  created?: Date;
}
```

### Property Options

| Option | Type | Description |
|--------|------|-------------|
| `hidden` | `boolean` | Hide from UI |
| `isId` | `boolean` | Mark as ID field |
| `required` | `boolean` | Required for parseFinal() validation |
| `disabled` | `boolean` | Always disabled/non-editable |
| `displayName` | `string` | Human-readable field label |
| `placeholder` | `string` | Input placeholder text |
| `helpText` | `string` | Help text shown below field |
| `presentAs` | `string` | UI presentation hint (interpreted by framework) |
| `column` | `string \| ColumnOptions` | Database [column](persistence.md) configuration |
| `resolvedFrom` | `string` | Resolved from another field |
| `requiredWhen` | `ConditionalRule` | [Conditionally required](#requiredwhen) |
| `excludeWhen` | `ConditionalRule` | [Conditionally excluded](#excludewhen) |
| `disabledWhen` | `ConditionalRule` | [Conditionally disabled](#disabledwhen) |

Properties use `?` (e.g., `name?: string`). Use `!` for IDs and belongs-to foreign keys (e.g., `id!: number`) to indicate they must exist from creation. Use `required: true` to indicate a property must have a value for the record to be complete.

```typescript
export class Student extends BusinessObject {
  @property({
    required: true,
    displayName: "First Name",
    placeholder: "Enter first name",
  })
  firstName?: string;

  @property({
    required: true,
    helpText: "Primary email used for all communications",
  })
  email?: Email;

  @property({ presentAs: "textarea" })
  notes?: string;

  @property({ disabled: true })
  enrollmentDate?: Date;
}
```

## Conditional Validation

Properties can have conditional requirements, visibility, and editability based on other property values. Conditions are type-checked arrow functions.

### requiredWhen

Make a field required when a condition is true:

```typescript
import { property } from "@apexdesigner/dsl";

export class Invoice extends BusinessObject {
  // ...

  total?: number;

  @property({
    requiredWhen: (invoice) => invoice.total > 1000,
  })
  executiveApproval?: string;
}
```

With a custom error message:

```typescript
@property({
  requiredWhen: {
    condition: (invoice) => invoice.total > 1000,
    message: 'Executive approval required for orders over $1000',
  }
})
executiveApproval?: string;
```

### excludeWhen

Hide a field when a condition is true:

```typescript
export class Invoice extends BusinessObject {
  // ...

  role?: 'admin' | 'user';

  @property({
    excludeWhen: (invoice) => invoice.role !== 'admin',
  })
  salary?: number;
}
```

### disabledWhen

Disable editing when a condition is true:

```typescript
export class Invoice extends BusinessObject {
  // ...

  status?: 'draft' | 'submitted' | 'approved';

  @property({
    disabledWhen: (invoice) => invoice.status === 'submitted',
  })
  notes?: string;
}
```

Conditions are enforced in:
- UI forms (show/hide, enable/disable, mark required)
- API endpoints (validate POST/PUT payloads)
- Background processes (validate data before processing)

## Relationships

A property typed as another business object defaults to a "Belongs To" relationship type.

```typescript
// ...

import { Organization } from "@business-objects";

export class Student extends BusinessObject {
  // ...

  organization?: Organization;
}
```

An array of another business object defaults to a "Has Many" relationship type:

```typescript
export class Organization extends BusinessObject {
  // ...

  students?: Student[];
}
```

Use `@relationship()` for non-default relationship types. "References" is a "Belongs To" that doesn't imply ownership. "Has One" is a singular "Has Many" type.

```typescript
// ...

import { relationship } from "@apexdesigner/dsl";
import { AppUser, StudentProfile } from "@business-objects";

export class Student extends BusinessObject {
  // ...

  @relationship({ type: "References" })
  appUser?: AppUser;

  @relationship({ type: "Has One" })
  profile?: StudentProfile;
}
```

When a business object has multiple relationships to the same type, use `pairedWith` to disambiguate:

```typescript
// ...

import { relationship } from "@apexdesigner/dsl";
import { AppUser } from "@business-objects";

export class Message extends BusinessObject {
  // ...

  sender?: AppUser;

  @relationship({ type: "References" })
  recipient?: AppUser;
}
```

```typescript
// ...

import { relationship } from "@apexdesigner/dsl";
import { Message } from "@business-objects";

export class AppUser extends BusinessObject {
  // ...

  @relationship({ pairedWith: "sender" })
  sentMessages?: Message[];

  @relationship({ pairedWith: "recipient" })
  receivedMessages?: Message[];
}
```

Use `pairedType` to control the inverse relationship type. This is especially useful when the related business object is from a library and can't be edited directly.

The inverse of a "Belongs To" or "References" defaults to "Has Many". Use `pairedType: "Has One"` when the inverse should be singular:

```typescript
// tutor/tutor.business-object.ts

import { relationship } from "@apexdesigner/dsl";
import { AppUser } from "@business-objects";

export class Tutor extends BusinessObject {
  // ...

  @relationship({ type: "References", pairedType: "Has One" })
  appUser?: AppUser;
}
```

The inverse of a "Has Many" or "Has One" defaults to "Belongs To". Use `pairedType: "References"` when the inverse shouldn't imply ownership:

```typescript
// session/session.business-object.ts

import { relationship } from "@apexdesigner/dsl";
import { AppUser } from "@business-objects";

export class Session extends BusinessObject {
  // ...

  @relationship({ pairedType: "References" })
  sessions?: AppUser[];
}
```

Use `"Embedded"` for objects or arrays stored within the parent record:

```typescript
// ...

import { relationship } from "@apexdesigner/dsl";
import { Address, PhoneNumber } from "@business-objects";

export class Student extends BusinessObject {
  // ...

  @relationship({ type: "Embedded" })
  address?: Address;

  @relationship({ type: "Embedded" })
  phoneNumbers?: PhoneNumber[];
}
```

## Data Source

By default, all business objects use the project default [data source](data-sources.md). Each data source generates a typed `apply` function in `@data-sources` to override:

```typescript
// ...

import { applyWarehouseDataSource } from "@data-sources";

export class Student extends BusinessObject {
  // ...
}

applyWarehouseDataSource(Student);
```

## Id Property

Every business object requires an `id` property. If not declared, a [validator](validators.md) automatically adds it with a type determined by:

1. The business object's [data source](data-sources.md) `defaultIdType`
2. The project's [default data source](project.md#default-data-source) `defaultIdType`
3. Fallback to `number` if neither is configured

```typescript
// Before validator
export class Student extends BusinessObject {
  firstName?: string;
  lastName?: string;
}

// After validator (data source has defaultIdType = Number)
export class Student extends BusinessObject {
  id!: number;

  firstName?: string;
  lastName?: string;
}
```

To use a different id type or name, declare it with `@property({ isId: true })`:

```typescript
export class Student extends BusinessObject {
  @property({ isId: true })
  uuid!: string;

  firstName?: string;
  lastName?: string;
}
```

The validator preserves your custom ID type and name.

## Foreign Keys

Every "Belongs To" and "References" relationship requires a foreign key property. If not declared, a [validator](validators.md) automatically adds it after the relationship property with:

- **Type**: Matches the related business object's id type
- **Name**: `{relationshipName}Id` (e.g., `organizationId` for `organization`)

```typescript
// Before validator
export class Student extends BusinessObject {
  firstName?: string;
  organization?: Organization;
}

// After validator (Organization has id: number)
export class Student extends BusinessObject {
  firstName?: string;

  organization?: Organization;
  organizationId!: number;
}
```

To use a non-standard foreign key name, specify it with `@relationship()`:

```typescript
export class Student extends BusinessObject {
  @relationship({ foreignKey: "organizationCode" })
  organization?: Organization;
  organizationCode!: string;  // Validator uses this name
}
```

## Applying Mixins

[Mixins](mixins.md) add reusable properties, relationships, and behaviors to a business object. Each mixin generates a typed `apply` function in `@mixins`. They are called after the class body.

```typescript
// ...

import { applyPreventChangesMixin } from "@mixins";
import { AppUser } from "@business-objects";

export class Student extends BusinessObject {
  // ...

  // from @mixins/prevent-changes

  locked?: boolean;

  @relationship({ type: "References" })
  lockedBy?: AppUser;
}

applyPreventChangesMixin(Student);
```

Some mixins accept configuration as a second parameter:

```typescript
// ...

import { applyAuditMixin } from "@mixins";

export class Student extends BusinessObject {
  // ...
}

applyAuditMixin(Student, { excludeProperties: ["created"] });
```

## Default Roles

If nothing is specified, all authenticated users can access and update a business object.
[Roles](roles.md) control access to the business object:

```typescript
// ...

import { applyDefaultRoles } from "@apexdesigner/dsl";
import { Administrator, Student as StudentRole, Tutor } from "@roles";

export class Student extends BusinessObject {
  // ...
}

applyDefaultRoles(Student, [Administrator, Tutor, StudentRole]);
```

## CRUD Behaviors

By default, all four CRUD behaviors (create, read, update, delete) are generated for every business object. Use `setCrudBehaviors()` to control which CRUD behaviors are generated and optionally override their roles:

```typescript
// ...

import { setCrudBehaviors } from "@apexdesigner/dsl";
import { Administrator, Student as StudentRole, Tutor } from "@roles";

export class Student extends BusinessObject {
  // ...
}

applyDefaultRoles(Student, [Administrator, Tutor, StudentRole]);

setCrudBehaviors(Student, {
  read: true,
  update: [Administrator, Tutor],
});
```

Each CRUD operation can be set to:

- `true` — generate the behavior using the [default roles](#default-roles)
- A [roles](roles.md) array — generate the behavior with the specified roles
- Omitted — do not generate the behavior

In the example above, only read and update are generated. Read uses the default roles (`Administrator`, `Tutor`, `StudentRole`), while update is restricted to `Administrator` and `Tutor`. Create and delete are not generated.

## Unique Constraints

Use `addUniqueConstraint()` to define unique constraints. It can be called multiple times for separate constraints:

```typescript
// ...

import { addUniqueConstraint } from "@apexdesigner/dsl";

export class Student extends BusinessObject {
  // ...

  email?: Email;

  studentCode?: string;

  organization?: Organization;

  @property({ resolvedFrom: "organization relationship" })
  organizationId!: number;
}

addUniqueConstraint(Student, ["email"]);
addUniqueConstraint(Student, ["organizationId", "studentCode"]);
```

## Names

Names like the display name, plural, and indefinite article are auto-derived from the class name. Use `setNames()` to override any that are incorrect:

```typescript
// ...

import { setNames } from "@apexdesigner/dsl";

export class Curriculum extends BusinessObject {
  // ...
}

setNames(Curriculum, {
  pluralName: "Curriculums",
  pluralDisplayName: "Curriculums",
});
```

All options are optional — only specify what needs to differ from the defaults:

| Option | Description | Example |
| --- | --- | --- |
| `displayName` | Singular display name | `"Purchase Order"` |
| `pluralName` | Plural form | `"Curriculums"` instead of `"Curricula"` |
| `pluralDisplayName` | Plural display name | `"Purchase Orders"` |
| `indefiniteArticle` | `"a"` or `"an"` | `"an"` for `"Order Entry"` |

## Test Data

Use `setTestData()` to declare default test data for a business object. This provides the defaults used by `createTestData()` in [behavior tests](behaviors.md#testing):

```typescript
// ...

import { setTestData } from "@apexdesigner/dsl";

export class Student extends BusinessObject {
  // ...
}

setTestData(Student, {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
});
```

## Complete Example

```typescript
import {
  BusinessObject,
  applyDefaultRoles,
  property,
  relationship,
  setNames,
} from "@apexdesigner/dsl";
import { DateWithoutTime, Email, GradeLevel } from "@base-types";
import { applyAuditMixin, applyPreventChangesMixin } from "@mixins";
import { Administrator, Student as StudentRole, Tutor } from "@roles";
import { AppUser, Organization } from "@business-objects";

export class Student extends BusinessObject {

  firstName?: string;

  lastName?: string;

  email?: Email;

  dateOfBirth?: DateWithoutTime;

  currentGradeLevel?: GradeLevel;

  @property({
    requiredWhen: (student) => {
      const age = new Date().getFullYear() - new Date(student.dateOfBirth).getFullYear();
      return age < 18;
    }
  })
  parentContact?: string;

  @property({ hidden: true })
  created?: Date;

  organization?: Organization;

  @relationship({ type: "References" })
  appUser?: AppUser;

  testResults?: TestResult[];

  prescriptions?: Prescription[];

  attendances?: Attendance[];

  // from @mixins/prevent-changes

  locked?: boolean;

  @relationship({ type: "References" })
  lockedBy?: AppUser;
}

applyAuditMixin(Student, { excludeProperties: ["created"] });

applyPreventChangesMixin(Student);

applyDefaultRoles(Student, [Administrator, Tutor, StudentRole]);

setNames(Student, { indefiniteArticle: "a" });

```
