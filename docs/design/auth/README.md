---
generated-from: design/project.ts
generated-by: design-docs.readme.md
---
# Auth

- [Avatar](./avatar/README.md)
- [Manage Role Assignments](./manage-role-assignments/README.md)
- [Select Role Field](./select-role-field/README.md)
- [Select User Field](./select-user-field/README.md)
## Business Objects

- [Role](./role.business-object.md) - Named authorization role that can be assigned to users.
- [User](./user.business-object.md) - Authenticated user identified by email address.
  - [Role Assignment](./role-assignment.business-object.md) - Associates a user with a role. Belongs to User (cascade delete),

## Interface Definitions

- [Auth Config](./auth-config.interface-definition.md)
- [Auth Context](./auth-context.interface-definition.md)

## Functions

- [Current User](./current-user.function.md)
- [Has Role](./has-role.function.md)

## Pages

- [Login](./login.page.md) - Public login page with a button to initiate OIDC login.
- [Not Authorized](./not-authorized.page.md) - Displayed when a user authenticates but is not registered in the system.
- [Switch User](./switch-user.page.md) - Allows administrators to switch to another user by selecting from a list.

## Services

- [Auth Service](./auth.service.md)

