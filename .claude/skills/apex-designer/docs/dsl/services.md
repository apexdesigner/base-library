# Services

A service provides shared logic that can be injected into [pages](pages.md), [components](components.md), and other services. Service files are named `<name>.service.ts` and by default are created in `design/services/`.

## Class

A service file exports a class that extends `Service`. The class name uses the entity name with a `Service` suffix (e.g., `AuthService`).
```typescript
// auth.service.ts

import { Service } from "@apexdesigner/dsl/service";

export class AuthService extends Service {}
```

## Properties

Properties are declared as class members. Use `@property()` only when configuration is needed.

### Data Properties

Business object properties are typed using generated client types from `@business-objects-client`. `read`, `save`, read options, and property triggers work the same as [pages](pages.md#data-properties).

```typescript
import { Service, property } from "@apexdesigner/dsl/service";
import { AppUserFormGroup } from "@business-objects-client";

export class AuthService extends Service {

  @property({ read: "Automatically" })
  currentUser!: AppUserFormGroup;

}
```

### Service Injection

Other services are injected as properties:

```typescript
import { Service } from "@apexdesigner/dsl/service";
import { NotificationService } from "@services";

export class AuthService extends Service {

  notificationService!: NotificationService;

}
```

## Methods

Methods are declared as class members. Use `@method()` only when configuration is needed.

Lifecycle hooks and debounce work the same as [pages](pages.md#methods).

```typescript
import { Service, method } from "@apexdesigner/dsl/service";

export class AuthService extends Service {

  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    // ...
  }

  async hasRole(roleName: string): Promise<boolean> {
    // ...
  }

}
```

## Complete Example

```typescript
import { Service, property, method } from "@apexdesigner/dsl/service";
import { AppUserFormGroup } from "@business-objects-client";

export class AuthService extends Service {

  @property({ read: "Automatically" })
  currentUser!: AppUserFormGroup;

  roles!: string[];

  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    this.roles = await this.currentUser.getRoles();
  }

  async hasRole(roleName: string): Promise<boolean> {
    return this.roles.includes(roleName);
  }

}
```
