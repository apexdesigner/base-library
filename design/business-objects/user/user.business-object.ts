import { BusinessObject, property, addUniqueConstraint } from '@apexdesigner/dsl';
import { RoleAssignment } from '@business-objects';

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

addUniqueConstraint(User, 'email');
