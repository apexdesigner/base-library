import { InterfaceDefinition } from '@apexdesigner/dsl';

/**
 * Audit Context
 *
 * Request-scoped context for passing audit event IDs between Before and After lifecycle hooks.
 */
export class AuditContext extends InterfaceDefinition {
  /** Pending create audit event IDs. */
  pendingCreateIds?: number[];

  /** Pending update audit event IDs. */
  pendingUpdateIds?: number[];

  /** Pending delete audit event IDs. */
  pendingDeleteIds?: number[];
}
