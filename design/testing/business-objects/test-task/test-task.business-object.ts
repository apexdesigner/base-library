import { BusinessObject, property, relationship } from '@apexdesigner/dsl';
import { Status } from '@base-types';
import { TestProject } from '@business-objects';

/**
 * Test Task
 *
 * A task belonging to a test project.
 */
export class TestTask extends BusinessObject {
  /** Id */
  id!: number;

  /** Name */
  @property({ autoFormat: 'capitalCase' })
  name?: string;

  /** Status */
  status?: Status;

  /** Sequence - Sort order for drag-and-drop reordering */
  sequence?: number;

  /** Project */
  @relationship({ type: 'Belongs To' })
  testProject?: TestProject;
  /** Test Project Id */
  testProjectId!: number;
}
