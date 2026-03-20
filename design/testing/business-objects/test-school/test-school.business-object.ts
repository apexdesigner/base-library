import {
  BusinessObject,
  property,
  addUniqueConstraint,
} from "@apexdesigner/dsl";
import { TestRoom } from "@business-objects";

/**
 * Test School
 *
 * A school with a unique name. Used as a shared reference
 * in export/import testing — schools must pre-exist in the
 * target database and are resolved by name.
 */
export class TestSchool extends BusinessObject {
  /** Id */
  id!: number;

  /** Name */
  @property({ required: true })
  name?: string;

  /** District */
  district?: string;

  /** Address */
  address?: string;

  /** Test Rooms */
  testRooms?: TestRoom[];
}

addUniqueConstraint(TestSchool, { fields: ["name"] });
