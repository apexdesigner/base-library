import { BusinessObject } from '@apexdesigner/dsl';
import { applyTestFileDataSource } from '@data-sources';
import { Uuid, Json } from '@base-types';
import { TestItem } from '@business-objects';

/**
 * Test Setting
 *
 * Configuration setting for testing.
 */
export class TestSetting extends BusinessObject {
  /** Id - Primary key */
  id!: Uuid;

  /** Name - Setting name */
  name?: string;

  /** Value - Setting value */
  value?: string;

  /** Description - Setting description */
  description?: string;

  /** Category - Setting category */
  category?: string;

  /** Is Active - Whether the setting is active */
  isActive?: boolean;

  /** Config - JSON configuration data */
  config?: Json;

  /** Test Items - Related test items */
  testItems?: TestItem[];
}

applyTestFileDataSource(TestSetting);
