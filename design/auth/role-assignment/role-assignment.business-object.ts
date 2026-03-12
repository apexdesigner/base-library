import { BusinessObject, relationship, addUniqueConstraint, applyDefaultRoles } from '@apexdesigner/dsl';
import { User, Role } from '@business-objects';
import { Administrator } from '@roles';

/**
 * Role Assignment
 *
 * Associates a user with a role. Belongs to User (cascade delete),
 * references Role (prevents deletion while assignments exist).
 */
export class RoleAssignment extends BusinessObject {
  /** ID - Primary key */
  id!: number;

  /** User - Assigned user */
  @relationship({ type: 'Belongs To' })
  user?: User;
  /** User ID - Foreign key to user */
  userId!: number;

  /** Role - Assigned role */
  @relationship({ type: 'References' })
  role?: Role;
  /** Role ID - Foreign key to role */
  roleId?: number;
}

addUniqueConstraint(RoleAssignment, { fields: ['userId', 'roleId'] });

applyDefaultRoles(RoleAssignment, [Administrator]);
