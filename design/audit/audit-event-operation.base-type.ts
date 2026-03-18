import { BaseType, applyValidValues } from '@apexdesigner/dsl';

/**
 * Audit Event Operation
 *
 * The type of operation that triggered an audit event.
 */
export class AuditEventOperation extends BaseType<string> {}

applyValidValues(AuditEventOperation, ['Create', 'Update', 'Delete']);
