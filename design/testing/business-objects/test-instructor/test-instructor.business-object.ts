import {
  BusinessObject,
  property,
  relationship,
  addUniqueConstraint,
} from "@apexdesigner/dsl";
import { Email } from "@base-types";
import { TestLesson, TestActivity } from "@business-objects";

/**
 * Test Instructor
 *
 * An instructor identified by email. Used as a shared reference
 * in export/import testing with a configured referenceAnchor
 * instead of a unique constraint on the FK composite.
 */
export class TestInstructor extends BusinessObject {
  /** Id */
  id!: number;

  /** Name */
  @property({ required: true })
  name?: string;

  /** Email - Unique email address */
  @property({ required: true })
  email?: Email;

  /** Subject */
  subject?: string;

  /** Test Lessons */
  testLessons?: TestLesson[];

  /** Test Activities */
  @relationship({ pairedWith: "guestInstructor" })
  testActivities?: TestActivity[];
}

addUniqueConstraint(TestInstructor, { fields: ["email"] });
