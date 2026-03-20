import {
  BusinessObject,
  property,
  relationship,
  addUniqueConstraint,
} from "@apexdesigner/dsl";
import { TestSchool, TestLesson } from "@business-objects";

/**
 * Test Room
 *
 * A room that belongs to a school. Used as a reference in
 * export/import testing — the anchor includes both the room
 * name and the school FK, exercising chained reference resolution.
 */
export class TestRoom extends BusinessObject {
  /** Id */
  id!: number;

  /** Name - Room name (e.g., "Room 204") */
  @property({ required: true })
  name?: string;

  /** Capacity */
  capacity?: number;

  /** School - The school this room belongs to */
  school?: TestSchool;
  /** School Id */
  schoolId!: number;

  /** Test Lessons */
  testLessons?: TestLesson[];
}

addUniqueConstraint(TestRoom, { fields: ["name", "schoolId"] });
