import { BusinessObject, property, relationship } from "@apexdesigner/dsl";
import { TestLesson, TestInstructor, TestMaterial } from "@business-objects";

/**
 * Test Activity
 *
 * An activity within a lesson. Owned by the lesson (belongs-to-parent)
 * so it is exported and imported with the lesson. Also references an
 * optional instructor, testing reference resolution on child objects.
 */
export class TestActivity extends BusinessObject {
  /** Id */
  id!: number;

  /** Title */
  @property({ required: true })
  title?: string;

  /** Duration Minutes */
  durationMinutes?: number;

  /** Sort Order - Display order within the lesson */
  sortOrder?: number;

  /** Lesson - Parent lesson */
  @relationship({ type: "Belongs To" })
  lesson?: TestLesson;
  /** Lesson Id */
  lessonId!: number;

  /** Guest Instructor - Optional override instructor for this activity */
  @relationship({ type: "References" })
  guestInstructor?: TestInstructor;
  /** Guest Instructor Id */
  guestInstructorId?: number;

  /** Test Materials */
  testMaterials?: TestMaterial[];
}
