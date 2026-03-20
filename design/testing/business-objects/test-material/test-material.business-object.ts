import { BusinessObject, property, relationship } from "@apexdesigner/dsl";
import { TestActivity } from "@business-objects";

/**
 * Test Material
 *
 * A handout or resource attached to an activity. This is a grandchild
 * of the lesson (lesson → activity → material), testing two-level
 * deep child synchronization during import.
 */
export class TestMaterial extends BusinessObject {
  /** Id */
  id!: number;

  /** Name */
  @property({ required: true })
  name?: string;

  /** Url - Link to the resource */
  url?: string;

  /** Activity - Parent activity */
  @relationship({ type: "Belongs To" })
  activity?: TestActivity;
  /** Activity Id */
  activityId!: number;
}
