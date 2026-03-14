---
generated-from: design/auth/client/role-guard.app-behavior.ts
generated-by: design-docs.app-behavior.doc.md
---
# Role Guard App Behavior

Client-side route guard that checks authentication and role requirements.

**Type:** Guard

**Stage:** Activate

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| route | `ActivatedRouteSnapshot` | Yes |  |
| state | `RouterStateSnapshot` | Yes |  |
| router | `Router` | Yes |  |
| authService | `AuthService` | Yes |  |
| snackBar | `MatSnackBar` | Yes |  |

## Returns

`Promise<boolean>`
