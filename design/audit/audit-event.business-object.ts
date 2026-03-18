import { BusinessObject, applyDefaultRoles } from '@apexdesigner/dsl';
import { AuditEventOperation, AuditEventStatus } from '@base-types';
import { Administrator } from '@roles';

/**
 * Audit Event
 *
 * Records a single audit event for a create, update, or delete operation on a business object.
 */
export class AuditEvent extends BusinessObject {
  /** Primary key. */
  id!: number;

  /** Name of the audited business object. */
  modelName?: string;

  /** ID of the audited record. */
  modelId?: number;

  /** When the event occurred. */
  date?: Date;

  /** Email of the user who performed the operation. */
  userEmail?: string;

  /** The operation type: Create, Update, or Delete. */
  operation?: AuditEventOperation;

  /** JSON representation of the data at the time of the operation. */
  dataJson?: string;

  /** Whether the operation completed: Pending or Complete. */
  status?: AuditEventStatus;
}

applyDefaultRoles(AuditEvent, [Administrator]);
