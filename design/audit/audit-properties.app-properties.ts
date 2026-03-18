import { AppProperties, property } from '@apexdesigner/dsl/app-properties';
import { AuditContext } from '@interface-definitions';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Audit Properties
 *
 * Server-side singleton state for the audit system. Holds the async context for passing audit event IDs between lifecycle hooks.
 */
export class AuditProperties extends AppProperties {
  /** Context - AsyncLocalStorage for audit request context */
  @property({ hidden: true })
  context?: AsyncLocalStorage<AuditContext>;
}
