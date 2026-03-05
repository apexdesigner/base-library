import { BusinessObject } from '@apexdesigner/dsl';

import { TestItem } from '@business-objects';

/**
 * Test Item Detail
 *
 * Extended details for a test item.
 */
export class TestItemDetail extends BusinessObject {
  /** Id - Primary key */
  id!: number;

  /** Notes - Detail notes */
  notes?: string;

  /** Priority - Priority level */
  priority?: number;

  /** Test Item - Parent test item */
  testItem?: TestItem;
  /** Test Item Id - Foreign key to test item */
  testItemId!: number;
}
