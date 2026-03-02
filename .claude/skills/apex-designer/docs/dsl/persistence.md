# Persistence

The defaults work well in most cases. These can be used to override them when needed.

## Table

Table names default to the snake case of the business object name (`StudentHistory` -> `student_history`). Use `setTable()` in a [business object](business-objects.md) to override:

```typescript
// ...

import { setTable } from "@apexdesigner/dsl";

export class Student extends BusinessObject {
  // ...
}

setTable(Student, { name: "student_record" });
```

## Property

Column names default to the snake case of the property name (`firstName` -> `first_name`). Use `@property()` to override:

```typescript
import { property } from "@apexdesigner/dsl";

export class Student extends BusinessObject {
  // ...

  @property({ column: { name: "student_first_name" } })
  firstName?: string;
}
```

Column types default based on the native type and the underlying data source (e.g. `string` maps to `text` in Postgres). Override the column type:

```typescript
export class Student extends BusinessObject {
  // ...

  @property({ column: { type: "varchar(100)" } })
  firstName?: string;
}
```

For auto-incrementing columns (typically on ID fields):

```typescript
export class Student extends BusinessObject {
  @property({ isId: true, column: { autoIncrement: true } })
  id!: number;
}
```

Or use a string shorthand for the full column definition:

```typescript
export class Student extends BusinessObject {
  // ...

  @property({ column: "varchar(100) NOT NULL DEFAULT ''" })
  firstName?: string;
}
```

## Relationship

"Embedded" relationships as JSON based on the underlying database (`JSONB` for Postgres). Use `@relationship()` to override the column type:

```typescript
import { relationship } from "@apexdesigner/dsl";
import { Address } from "@business-objects";

export class Student extends BusinessObject {
  // ...

  @relationship({ type: "Embedded", column: { type: "text" } })
  address?: Address;
}
```

## Index

Use `addIndex()` in a [business object](business-objects.md) to create database indexes. It can be called multiple times:

```typescript
// ...

import { addIndex } from "@apexdesigner/dsl";

export class Student extends BusinessObject {
  // ...

  lastName?: string;

  organization?: Organization;

  @property({ resolvedFrom: "organization relationship" })
  organizationId!: number;
}

addIndex(Student, ["lastName"]);
addIndex(Student, ["organizationId", "lastName"]);
```

Use the object form for sort order or filtered indexes:

```typescript
addIndex(Student, {
  columns: [
    { name: "organizationId" },
    { name: "lastName", sort: "ASC" },
  ],
  where: "lastName IS NOT NULL",
});
```

## View

A [business object](business-objects.md) can be backed by a database view instead of a table. Use `setView()` to provide the SQL:

```typescript
// ...

import { setView } from "@apexdesigner/dsl";
import { Organization } from "@business-objects";

export class OrganizationStudentCount extends BusinessObject {
  organization?: Organization;

  @property({ resolvedFrom: "organization relationship" })
  organizationId!: number;

  studentCount?: number;
}

setView(OrganizationStudentCount, `
  SELECT
    o.id AS organization_id,
    COUNT(s.id) AS student_count
  FROM organization o
  LEFT JOIN student s ON s.organization_id = o.id
  GROUP BY o.id
`);
```

## Base Type Column

Use `setPropertyDefaults()` in a [base type](base-types.md) to set the default column for all properties that use that type:

```typescript
import { BaseType, setPropertyDefaults } from "@apexdesigner/dsl";

export class Currency extends BaseType<number> {}

setPropertyDefaults(Currency, {
  column: { type: "decimal", precision: 18, scale: 4 },
});
```

Or as a shorthand string:

```typescript
import { BaseType, setPropertyDefaults } from "@apexdesigner/dsl";

export class Currency extends BaseType<number> {}

setPropertyDefaults(Currency, {
  column: "decimal(18,4)",
});
```

Properties can override the base type default using `@property()`:

```typescript
export class Product extends BusinessObject {
  // Uses default: decimal(18,4)
  price?: Currency;

  // Overrides default with custom precision
  @property({ column: { type: "decimal", precision: 10, scale: 2 } })
  discountPrice?: Currency;
}
```
