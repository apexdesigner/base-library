# Data Sources

A data source defines the persistence layer for [business objects](business-objects.md). Data source files are named `<name>.data-source.ts` and by default are created in `design/data-sources/`.

## Class

A data source file exports a class that extends `DataSource`.

```typescript
// postgres.data-source.ts

import { DataSource } from "@apexdesigner/dsl";

export class Postgres extends DataSource {}
```

## Default Id Type

Set `defaultIdType` to define the type used for auto-generated `id` properties on business objects that use this data source.

Use a native type constructor for primitive types:

```typescript
import { DataSource } from "@apexdesigner/dsl";

export class Postgres extends DataSource {
  defaultIdType = Number;
}
```

Or use a base type for specialized ID types:

```typescript
import { DataSource } from "@apexdesigner/dsl";
import { Serial } from "@base-types";

export class Postgres extends DataSource {
  defaultIdType = Serial;
}
```

Native constructors include `Number`, `String`, `Boolean`, and `Date`.

## Configuration

Set `configuration` for data source connection settings:

```typescript
import { DataSource } from "@apexdesigner/dsl";

export class Postgres extends DataSource {
  defaultIdType = Number;

  configuration = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
  };
}
```

## Default Data Source

Set `isDefault` to make a data source the default for all business objects that don't have an explicit data source assigned:

```typescript
import { DataSource } from "@apexdesigner/dsl";

export class Postgres extends DataSource {
  defaultIdType = Number;
  isDefault = true;
}
```

Only one data source should have `isDefault = true` (enforced by a validator).
