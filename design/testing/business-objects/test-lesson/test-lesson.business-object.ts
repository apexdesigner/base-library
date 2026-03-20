import { BusinessObject, property, relationship } from "@apexdesigner/dsl";
import { applyExportImportMixin } from "@mixins";
import { TestRoom, TestInstructor, TestActivity } from "@business-objects";

/**
 * Test Lesson
 *
 * A scheduled lesson that references both a room and an instructor.
 * This is the export root — exporting a lesson captures its child
 * activities, and includes the room (with its school chain) and
 * instructor as references that must pre-exist on import.
 */
export class TestLesson extends BusinessObject {
  /** Id */
  id!: number;

  /** Title */
  @property({ required: true })
  title?: string;

  /** Scheduled At - When the lesson takes place */
  scheduledAt?: Date;

  /** Notes */
  notes?: string;

  /** Room - Where the lesson takes place */
  @relationship({ type: "References" })
  room?: TestRoom;
  /** Room Id */
  roomId?: number;

  /** Instructor - Who teaches the lesson */
  @relationship({ type: "References" })
  instructor?: TestInstructor;
  /** Instructor Id */
  instructorId?: number;

  /** Test Activities */
  testActivities?: TestActivity[];
}

applyExportImportMixin(TestLesson, {
  referenceAnchors: {
    TestInstructor: ["email"],
  },
});
