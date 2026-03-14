---
generated-from: design/auth/users-and-roles/assign-default-administrators.app-behavior.ts
generated-by: design-docs.app-behavior.doc.md
---
# Assign Default Administrators App Behavior

Ensures users matching ADMINISTRATOR_EMAILS have the Administrator role.
Runs after sync-static-roles so the role is guaranteed to exist.

**Type:** Lifecycle Behavior

**Stage:** Running
