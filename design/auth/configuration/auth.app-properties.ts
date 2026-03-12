import { AppProperties, property } from '@apexdesigner/dsl/app-properties';
import { AuthConfig, AuthContext } from '@interface-definitions';
import { AsyncLocalStorage } from 'node:async_hooks';
import jwksRsa from 'jwks-rsa';

/**
 * Auth
 *
 * Server-side singleton state for authentication. Holds the JWKS client,
 * sub-to-email cache, and async context for authenticated requests.
 */
export class Auth extends AppProperties {
  /** Config - OIDC configuration loaded at startup */
  @property({ hidden: true })
  config?: AuthConfig;

  /** JWKS Client - Lazily initialized client for fetching JSON Web Key Sets */
  @property({ hidden: true })
  jwksClient?: jwksRsa.JwksClient;

  /** Sub Email Cache - Maps OIDC subject claims to email addresses for fast lookup */
  @property({ hidden: true })
  subEmailCache?: Map<string, string>;

  /** In-Flight Requests - Deduplicates concurrent userinfo fetches by subject claim */
  @property({ hidden: true })
  inFlightRequests?: Map<string, Promise<string | null>>;

  /** Is Public Route - Function that checks if a request path is public */
  @property({ hidden: true })
  isPublicRoute?: (path: string) => boolean;

  /** Context - AsyncLocalStorage for authenticated request context */
  @property({ hidden: true })
  context?: AsyncLocalStorage<AuthContext>;
}
