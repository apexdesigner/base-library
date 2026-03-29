import { BusinessObject, relationship } from "@apexdesigner/dsl";
import { TestProject } from "../test-project/test-project.business-object";

/**
 * Test Task
 *
 * A task belonging to a test project.
 */
export class TestTask extends BusinessObject {
  /** Id */
  id!: number;

  /** Name */
  name?: string;

  /** Status */
  status?: string;

  /** Project */
  @relationship({ type: "Belongs To" })
  testProject?: TestProject;
  /** Test Project Id */
  testProjectId!: number;
}
