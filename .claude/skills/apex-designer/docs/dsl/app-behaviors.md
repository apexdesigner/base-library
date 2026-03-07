# App Behaviors

An app behavior adds application-level logic that is not tied to a specific [business object](business-objects.md). App behaviors can target the server (Class Behavior, Middleware, Lifecycle Behavior) or client (Provider, Interceptor, Guard). The [`layer`](#layer) option defaults to `"Server"` and can be set explicitly to target the client. App behavior files are named `<name>.app-behavior.ts` and by default are created in `design/app-behaviors/`.

## Structure

An app behavior file calls `addAppBehavior()` with options and a named function. The behavior name is taken from the function name.

```typescript
// system-health-check.app-behavior.ts

import { addAppBehavior } from "@apexdesigner/dsl";

addAppBehavior(
  {
    type: "Class Behavior",
    httpMethod: "Get",
    path: "/api/health",
  },
  async function systemHealthCheck() {
    // ...
  },
);
```

The `name` override, endpoint options (`httpMethod`, `path`, `roles`), and reserved word handling work the same as [business object behaviors](behaviors.md). Paths default to `/api/<kebab-behavior-name>`.

## Class Behaviors

Class behaviors are custom API endpoints:

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";

addAppBehavior(
  {
    type: "Class Behavior",
    httpMethod: "Get",
    path: "/api/health",
  },
  async function systemHealthCheck() {
    // ...
  },
);
```

Use [interface definitions](interface-definitions.md) to type inputs and outputs:

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";
import { SearchCriteria, SearchResults } from "@interface-definitions";

addAppBehavior(
  {
    type: "Class Behavior",
    httpMethod: "Post",
    path: "/api/search",
  },
  async function search(body: SearchCriteria): Promise<SearchResults> {
    // ...
  },
);
```

## Event Handlers

Event handlers respond to custom application events:

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";

addAppBehavior(
  {
    type: "Event Handler",
    eventName: "userLogin",
  },
  async function handleUserLogin(event: any) {
    // ...
  },
);
```

## Lifecycle Behaviors

Lifecycle behaviors run at specific application lifecycle stages. Both `stage` and `sequence` are required (enforced by a validator).

### Stages

- **`Startup`** — runs before the app accepts requests, ordered by `sequence` (1-999)
- **`Running`** — runs after the app is live and accepting requests
- **`Shutdown`** — runs before the app stops, for graceful cleanup

### Startup

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";
import { App } from "@app";

addAppBehavior(
  {
    type: "Lifecycle Behavior",
    stage: "Startup",
    sequence: 100,
  },
  async function initializeCache() {
    App.caches.orderCache = new Map();
  },
);
```

#### Startup Sequence Guidelines

- **1-99**: Early initialization (logging, config)
- **100-299**: Data setup (caches, lookups)
- **300-499**: Service initialization (external clients, connections)
- **500**: Middleware registration (implicit)
- **501-699**: Post-middleware setup
- **700-899**: Late initialization
- **900-999**: Final startup tasks

Libraries should use round numbers (100, 200, 300) to allow projects to insert behaviors between them.

### Running

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";

addAppBehavior(
  {
    type: "Lifecycle Behavior",
    stage: "Running",
    sequence: 100,
  },
  async function registerWithServiceRegistry() {
    // ...
  },
);
```

### Shutdown

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";
import { App } from "@app";

addAppBehavior(
  {
    type: "Lifecycle Behavior",
    stage: "Shutdown",
    sequence: 900,
  },
  async function flushCaches() {
    App.caches.orderCache.clear();
  },
);
```

## Middleware

Middleware behaviors intercept and process requests before they reach the main handler. Middleware runs in sequence (0-999, where lower numbers execute first). The actual request processing happens at the implicit sequence position of 1000.

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";

addAppBehavior(
  {
    type: "Middleware",
    sequence: 100,
  },
  async function authenticationMiddleware(req: any, res: any, next: () => void) {
    // Verify authentication
    if (!req.headers.authorization) {
      return res.status(401).send("Unauthorized");
    }
    next();
  },
);
```

### Ordering Guidelines

- **0-99**: Early middleware (CORS, security headers)
- **100-299**: Authentication and authorization
- **300-499**: Request parsing and validation
- **500-699**: Business logic middleware
- **700-899**: Logging and monitoring
- **900-999**: Late-stage middleware
- **1000**: Main request processing (implicit, not explicitly set)

Libraries should use round numbers (100, 200, 300) to allow projects to insert middleware between them (150, 250, etc.).

## Providers

Providers register framework-level services at application bootstrap. The function returns the provider configuration synchronously.

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";

addAppBehavior(
  {
    type: "Provider",
    layer: "Client",
  },
  function authProvider(): EnvironmentProviders {
    // ...
    return environmentProviders;
  },
);
```

No `sequence` or `stage` — providers are unordered.

## Interceptors

Interceptors process HTTP requests and responses on the client. They use `sequence` for ordering, like server-side [Middleware](#middleware).

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";

addAppBehavior(
  {
    type: "Interceptor",
    sequence: 100,
    layer: "Client",
  },
  async function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Promise<HttpEvent<unknown>> {
    // ...
    return next(req);
  },
);
```

### Interceptor Sequence Guidelines

- **100-199**: Authentication (attach tokens)
- **200-299**: Error handling (401s, retries)
- **300-499**: Request/response transformation
- **500-699**: Logging and monitoring
- **700-899**: Caching

## Guards

Guards control route navigation. They use `stage` and `sequence` for ordering.

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";

addAppBehavior(
  {
    type: "Guard",
    stage: "Activate",
    sequence: 100,
    layer: "Client",
  },
  async function roleGuard(route: ActivatedRouteSnapshot, router: Router): Promise<boolean> {
    // ...
    return true;
  },
);
```

### Guard Stages

- **`Activate`** — runs before a route is activated (canActivate)
- **`Deactivate`** — runs before leaving a route (canDeactivate)

## Layer

Use `layer` to explicitly set whether an app behavior targets the client or server:

```typescript
addAppBehavior(
  {
    type: "Class Behavior",
    httpMethod: "Get",
    layer: "Client",
  },
  async function getTheme() {
    // ...
  },
);
```

When omitted, the generator infers the layer from the type: Provider, Interceptor, and Guard target the client; Class Behavior, Middleware, and Lifecycle Behavior target the server.

## Service Tasks

Service tasks are asynchronous functions managed by the [process](processes.md) engine. The function signature defines the typed inputs and outputs:

```typescript
import { addAppBehavior } from "@apexdesigner/dsl";
import { Order, Customer } from "@business-objects";

addAppBehavior(
  {
    type: "Service Task",
  },
  async function sendConfirmationEmail(inputs: { order: Order; customer: Customer }) {
    // ... implementation
    return { trackingNumber: "ABC123" };
  },
);
```

In a [process](processes.md), wrap with `createServiceTask()` to enable boundary events:

```typescript
import { sendConfirmationEmail } from "@app-behaviors";

createServiceTask(sendConfirmationEmail({ order: this.order, customer: this.customer }))
  .then((outputs) => {
    this.trackingNumber = outputs.trackingNumber;
    this.end();
  })
  .boundaryEvents({
    timeout: timer({ duration: 'PT1H' }).then(this.escalate),
  });
```

## Testing

Use `addTest()` in an app behavior file to define tests. Tests use [test fixtures](test-fixtures.md) and CRUD APIs to set up data, with vitest assertions:

```typescript
// get-active-orders.app-behavior.ts

import { addAppBehavior, addTest } from "@apexdesigner/dsl";
import { Order } from "@business-objects";
import { expect } from "vitest";

addAppBehavior(
  {
    type: "Class Behavior",
    httpMethod: "Get",
  },
  async function getActiveOrders() {
    // ...
  },
);

addTest("should return only active orders", async () => {
  await Order.testFixtures.active();
  await Order.create({ status: "cancelled" });

  const result = await getActiveOrders();
  expect(result).toHaveLength(1);
});
```
