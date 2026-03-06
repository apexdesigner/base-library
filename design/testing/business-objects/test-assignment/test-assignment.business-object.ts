import { BusinessObject, property } from '@apexdesigner/dsl';

/**
 * Test Assignment
 *
 * Test business object with presentAs fields for testing select fields.
 */
export class TestAssignment extends BusinessObject {
  /** Id - Primary key */
  id!: number;

  /** Name - Assignment name */
  name?: string;

  /** User ID - Selected user */
  @property({ presentAs: 'select-user' })
  userId?: number;

  /** Role ID - Selected role */
  @property({ presentAs: 'select-role' })
  roleId?: number;
}
