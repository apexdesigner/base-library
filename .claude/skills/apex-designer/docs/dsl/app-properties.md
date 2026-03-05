# App Properties

App properties define properties that are added to the app class. They are used for server-side singleton state such as caches, shared lookups, or external client instances. App properties files are named `<name>.app-properties.ts` and by default are created in `design/app-properties/<name>/`.

## Class

An app properties file exports a class that extends `AppProperties`:

```typescript
// caches/caches.app-properties.ts

import { AppProperties } from "@apexdesigner/dsl/app-properties";

export class Caches extends AppProperties {
  orderCache?: Map<number, Order>;
  studentCache?: Map<number, Student>;
}
```

Multiple app properties classes can exist in a project. Each class becomes a namespaced group on the app singleton, accessed as `App.<camelCaseName>.<propertyName>`:

```
App.caches.orderCache
App.caches.studentCache
```

## Properties

Properties are type annotations, the same as [business object](business-objects.md) properties. Native types (`string`, `number`, `boolean`), [base types](base-types.md), [interface definitions](interface-definitions.md), and complex types (`Map`, arrays, custom classes) are supported.

```typescript
import { AppProperties } from "@apexdesigner/dsl/app-properties";

export class Caches extends AppProperties {
  orderCache?: Map<number, Order>;
  studentCache?: Map<number, Student>;
  refreshIntervalMs?: number;
}
```

Properties typed as an [interface definition](interface-definitions.md) are embedded directly:

```typescript
import { AppProperties } from "@apexdesigner/dsl/app-properties";
import { ServiceEndpoint } from "@interface-definitions";

export class ApiClients extends AppProperties {
  endpoints?: ServiceEndpoint[];
  primaryEndpoint?: ServiceEndpoint;
}
```

Use `@property()` when modifiers are needed:

```typescript
import { AppProperties, property } from "@apexdesigner/dsl/app-properties";

export class Caches extends AppProperties {
  @property({ hidden: true })
  orderCache?: Map<number, Order>;

  @property({
    displayName: "Cache Refresh Interval",
    helpText: "How often the cache is refreshed, in milliseconds",
  })
  refreshIntervalMs?: number;
}
```

### Property Options

| Option | Type | Description |
|--------|------|-------------|
| `hidden` | `boolean` | Hide from UI |
| `required` | `boolean` | Must be initialized at startup |
| `disabled` | `boolean` | Read-only, not configurable |
| `displayName` | `string` | Human-readable field label |
| `placeholder` | `string` | Input placeholder text |
| `helpText` | `string` | Help text shown below field |
| `presentAs` | `string` | UI presentation hint |
| `requiredWhen` | `ConditionalRule` | Conditionally required |
| `excludeWhen` | `ConditionalRule` | Conditionally excluded |
| `disabledWhen` | `ConditionalRule` | Conditionally disabled |

## Accessing App Properties

App properties are accessed via the `App` object using the camel-cased class name as a namespace:

```typescript
// In an app behavior
import { addAppBehavior } from "@apexdesigner/dsl";
import { App } from "@app";

addAppBehavior(
  { type: "Class Behavior", httpMethod: "Get", path: "/api/cached-orders" },
  async function getCachedOrders() {
    return Array.from(App.caches.orderCache.values());
  },
);
```

## Multiple App Properties Classes

Group related properties into separate classes by concern:

```typescript
// caches/caches.app-properties.ts
export class Caches extends AppProperties {
  orderCache?: Map<number, Order>;
}

// api-clients/api-clients.app-properties.ts
export class ApiClients extends AppProperties {
  @property({ hidden: true })
  stripeClient?: StripeClient;
}

// feature-flags/feature-flags.app-properties.ts
export class FeatureFlags extends AppProperties {
  enableNewCheckout?: boolean;
  maxUploadSizeMb?: number;
}
```

Accessed as:

```
App.caches.orderCache
App.apiClients.stripeClient
App.featureFlags.enableNewCheckout
```

## Libraries

Libraries can define app properties that consuming projects inherit. Library-defined app properties are accessed the same way via `App.<camelCaseName>.<propertyName>`.
