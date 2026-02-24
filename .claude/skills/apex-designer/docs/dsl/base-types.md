# Base Types

A base type is a class that adds validation, constrained values, or design-specific semantics to a native type. Base type files are named `<name>.base-type.ts` and by default are created in `design/base-types/`.

## Class

A base type exports a class that extends `BaseType` with a generic parameter for the underlying native type:

```typescript
// email.base-type.ts

import { BaseType } from "@apexdesigner/dsl";

export class Email extends BaseType<string> {}
```

```typescript
import { BaseType } from "@apexdesigner/dsl";

export class Minutes extends BaseType<number> {}
```

## Validation

Use `applyValidation()` to add constraints:

```typescript
import { BaseType, applyValidation } from "@apexdesigner/dsl";

export class Email extends BaseType<string> {}

applyValidation(Email, {
  pattern: "^[^@]+@[^@]+\\.[^@]+$",
  patternMessage: "Must be a valid email address",
});
```

Numeric types support range validation:

```typescript
import { BaseType, applyValidation } from "@apexdesigner/dsl";

export class Minutes extends BaseType<number> {}

applyValidation(Minutes, {
  minimum: 0,
});
```

## Valid Values

Use `applyValidValues()` to constrain a type to a fixed set of options:

```typescript
import { BaseType, applyValidValues } from "@apexdesigner/dsl";

export class DayOfWeek extends BaseType<string> {}

applyValidValues(DayOfWeek, [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);
```

When values need display labels, use name/value pairs:

```typescript
import { BaseType, applyValidValues } from "@apexdesigner/dsl";

export class GradeLevel extends BaseType<string> {}

applyValidValues(GradeLevel, [
  { name: "Kindergarten", value: "K" },
  { name: "1st Grade", value: "1" },
  { name: "2nd Grade", value: "2" },
  // ...
  { name: "12th Grade", value: "12" },
  { name: "Adult", value: "Adult" },
]);
```

Values can also be numeric:

```typescript
import { BaseType, applyValidValues } from "@apexdesigner/dsl";

export class Priority extends BaseType<number> {}

applyValidValues(Priority, [
  { name: "Low", value: 1 },
  { name: "Medium", value: 2 },
  { name: "High", value: 3 },
]);
```

Add descriptions for additional context in UI selectors:

```typescript
import { BaseType, applyValidValues } from "@apexdesigner/dsl";

export class Priority extends BaseType<number> {}

applyValidValues(Priority, [
  {
    name: "Low",
    value: 1,
    description: "Minor issues that can be addressed later",
  },
  {
    name: "Medium",
    value: 2,
    description: "Important but not urgent",
  },
  {
    name: "High",
    value: 3,
    description: "Urgent issues requiring immediate attention",
  },
]);
```

Boolean values are also supported:

```typescript
import { BaseType, applyValidValues } from "@apexdesigner/dsl";

export class FeatureFlag extends BaseType<boolean> {}

applyValidValues(FeatureFlag, [
  {
    name: "Enabled",
    value: true,
    description: "Feature is active for all users",
  },
  {
    name: "Disabled",
    value: false,
    description: "Feature is hidden from users",
  },
]);
```

## Usage

Base types are imported from `@base-types` and used as property types in [business objects](business-objects.md):

```typescript
import { DateWithoutTime, Email, GradeLevel } from "@base-types";

export class Student extends BusinessObject {
  // ...

  email?: Email;
  dateOfBirth?: DateWithoutTime;
  currentGradeLevel?: GradeLevel;
}
```

When a native type is sufficient, use it directly — there is no need to create a base type for `string`, `number`, `boolean`, or `Date`.
