import { BusinessObject, addUniqueConstraint, addIndex, applyDefaultRoles } from '@apexdesigner/dsl';
import { RoleAssignment } from '@business-objects';
import { Administrator } from '@roles';

/**
 * User
 *
 * Authenticated user identified by email address.
 */
export class User extends BusinessObject {
  /** ID - Primary key */
  id!: number;

  /** Email - User email address */
  email!: string;

  /** Role Assignments - Roles assigned to this user */
  roleAssignments?: RoleAssignment[];
}

addUniqueConstraint(User, { fields: ['email'] });

addIndex(User, { name: 'user_email_idx', properties: [{ name: 'email' }] });

applyDefaultRoles(User, [Administrator]);
