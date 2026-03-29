import { BusinessObject, relationship } from '@apexdesigner/dsl';

/**
 * Test Project
 *
 * A project for testing parent-child relationships with accordion.
 */
export class TestProject extends BusinessObject {
  /** Id */
  id!: number;

  /** Name */
  name?: string;

  /** Description */
  description?: string;

  /** Tasks */
  @relationship({ type: 'Has Many' })
  testTasks?: TestTask[];
}

import { TestTask } from '../test-task/test-task.business-object';
