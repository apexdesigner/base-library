---
generated-from: design/auth/get-user-profile.function.ts
generated-by: design-docs.function.doc.md
---
# Get User Profile Function

Fetches the user profile from the OIDC userinfo endpoint with
caching and in-flight request deduplication.

**Layer:** Server

## Inputs

| Name | Type | Description |
|------|------|-------------|
| sub | `string` | Subject identifier (unique user ID) |
| issuer | `string` | OIDC issuer URL |
| accessToken | `string` | Bearer token for the userinfo request |
| tokenExp | `number` | Token expiration timestamp (seconds) |
| cache | `Map<string, { profile: UserProfile; expiresAt: number }>` | Cache map for resolved profiles |
| inFlight | `Map<string, Promise<UserProfile \| null>>` | Map of in-flight fetch promises for deduplication |

## Output

`Promise<UserProfile \| null>` - The user profile or null if the fetch fails
