---
generated-from: design/auth/user-profile.interface-definition.ts
generated-by: design-docs.interface-definition.doc.md
---
# User Profile Interface Definition

User profile returned from the OIDC userinfo endpoint.

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sub | `string` | Always | Sub - Subject identifier (unique user ID from the identity provider) |
| email | `string` | No | Email |
| emailVerified | `boolean` | No | Email Verified |
| name | `string` | No | Name |
| givenName | `string` | No | Given Name |
| familyName | `string` | No | Family Name |
| nickname | `string` | No | Nickname |
| picture | `string` | No | Picture |
