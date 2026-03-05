import { Service } from '@apexdesigner/dsl/service';

/**
 * Test Item Tracker
 *
 * Service for tracking test item state.
 */
export class TestItemTrackerService extends Service {
  /** Message - Current tracking message */
  message!: string;
}
