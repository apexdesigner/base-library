import { InterfaceDefinition } from '@apexdesigner/dsl';

/**
 * Auth Config
 *
 * OIDC authentication configuration loaded from `design/server/auth-config.json`.
 * Individual properties can be overridden with environment variables
 * (e.g. `AUTH_ISSUER`, `AUTH_CLIENT_ID`).
 */
export class AuthConfig extends InterfaceDefinition {
  /** Issuer - OIDC issuer URL (e.g. `https://example.auth0.com/`) */
  issuer!: string;

  /** Audience - API audience identifier for token validation */
  audience!: string;

  /** Client ID - OAuth client ID for the SPA */
  clientId!: string;

  /** JWKS URI - Override for the JSON Web Key Set URI; derived from issuer discovery if not set */
  jwksUri?: string;

  /** Algorithms - Allowed JWT signing algorithms (defaults to `["RS256"]`) */
  algorithms?: string[];

  /** Token Cache TTL - How long to cache validated tokens in seconds (defaults to 3600) */
  tokenCacheTTL?: number;

  /** Require Tenant ID - Whether requests must include a tenant ID claim */
  requireTenantId?: boolean;

  /** Domain - Auth0/OIDC domain for the SPA client; derived from issuer if not set */
  domain?: string;

  /** Scopes - Scopes requested by the SPA (defaults to `["openid", "profile", "email"]`) */
  scopes?: string[];

  /** Logout URL - URL to redirect to after logout */
  logoutUrl?: string;

  /** Use Custom Auth0 Domain - Whether the SPA uses an Auth0 custom domain */
  useCustomAuth0Domain?: boolean;
}
