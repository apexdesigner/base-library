import { BusinessObject, property, relationship } from '@apexdesigner/dsl';
import { User, Role } from '@business-objects';

/**
 * Test Assignment
 *
 * Test business object with user and role foreign keys for testing select fields.
 */
export class TestAssignment extends BusinessObject {
  /** Id - Primary key */
  id!: number;

  /** Name - Assignment name */
  name?: string;

  /** User - Assigned user */
  @relationship({ type: 'References' })
  user?: User;

  /** User ID - Foreign key to user */
  @property({ hidden: false, presentAs: 'select-user' })
  userId?: number;

  /** Role - Assigned role */
  @relationship({ type: 'References' })
  role?: Role;

  /** Role ID - Foreign key to role */
  @property({ hidden: false, presentAs: 'select-role' })
  roleId?: number;
}
