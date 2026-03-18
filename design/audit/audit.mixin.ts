import { Mixin } from '@apexdesigner/dsl';

export interface AuditConfig {
  excludeProperties?: string[];
}

/**
 * Audit
 *
 * Records audit events for create, update, and delete operations with configurable property exclusion.
 */
export class Audit extends Mixin {}
