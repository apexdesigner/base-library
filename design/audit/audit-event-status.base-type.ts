import { BaseType, applyValidValues } from '@apexdesigner/dsl';

/**
 * Audit Event Status
 *
 * The completion status of an audit event.
 */
export class AuditEventStatus extends BaseType<string> {}

applyValidValues(AuditEventStatus, ['Pending', 'Complete']);
