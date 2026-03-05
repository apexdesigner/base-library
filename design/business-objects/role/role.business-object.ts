import { BusinessObject, property, addUniqueConstraint } from '@apexdesigner/dsl';
import { RoleAssignment } from '@business-objects';

/**
 * Role
 *
 * Named authorization role that can be assigned to users.
 */
export class Role extends BusinessObject {
  /** ID - Primary key */
  id!: number;

  /** Name - Unique role identifier */
  @property({ required: true })
  name?: string;

  /** Display Name - Human-readable role label */
  displayName?: string;

  /** Description - Role purpose and permissions summary */
  description?: string;

  /** Role Assignments - Users assigned to this role */
  roleAssignments?: RoleAssignment[];
}

addUniqueConstraint(Role, 'name');
