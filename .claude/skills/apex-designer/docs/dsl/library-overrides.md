# Library Overrides

A project can extend or override design items defined in a [library](project.md#design-dependencies). Because all `apply` and `add` functions take the design item as an explicit parameter, they can be called from any file — not just the file that defines the item.

## Business Objects

Add mixins, roles, constraints, or change the data source on a library-defined business object.

`design/business-objects/app-user/app-user.business-object.ts`:

```typescript
import { applyDefaultRoles, addUniqueConstraint } from "@apexdesigner/dsl";
import { applyAuditMixin } from "@mixins";
import { applyWarehouseDataSource } from "@data-sources";
import { AppUser } from "@business-objects";
import { Administrator, Tutor } from "@roles";

applyAuditMixin(AppUser);
applyWarehouseDataSource(AppUser);
applyDefaultRoles(AppUser, [Administrator, Tutor]);
addUniqueConstraint(AppUser, ["email"]);
```

## Pages

Override roles on a library-defined page.

`design/pages/users-page.page.ts`:

```typescript
import { applyDefaultRoles } from "@apexdesigner/dsl";
import { UsersPage } from "@pages";
import { Administrator } from "@roles";

applyDefaultRoles(UsersPage, [Administrator]);
```

## Behaviors

Add a behavior to a library-defined business object by creating a behavior file in the project.

`design/business-objects/app-user/app-user.send-welcome-email.behavior.ts`:

```typescript
import { addBehavior } from "@apexdesigner/dsl";
import { AppUser } from "@business-objects";

addBehavior(
  AppUser,
  {
    type: "After Create",
  },
  async function sendWelcomeEmail(appUser: AppUser) {
    // ...
  },
);
```

## Validators

Override a library validator by defining one with the same name. The project's validator replaces the library's.

## File Location

These files can live anywhere in the `design/` directory. The paths above follow the default conventions.
