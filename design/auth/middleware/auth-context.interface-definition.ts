import { InterfaceDefinition } from '@apexdesigner/dsl';
import { User } from '@business-objects';
import { Role } from '@business-objects';

/**
 * Auth Context
 *
 * Authenticated request context stored in AsyncLocalStorage.
 * Available downstream via `App.auth.context.getStore()`.
 */
export class AuthContext extends InterfaceDefinition {
  /** User - Authenticated user instance from the database */
  user?: User;

  /** Access Token - Decoded JWT access token claims */
  accessToken?: any;

  /** Tenant ID - Tenant identifier extracted from token claims */
  tenantId?: string;

  /** Roles - Authorization roles assigned to this user */
  roles?: Role[];

  /** System Request - When true, role checking is bypassed for this request */
  systemRequest?: boolean;
}
