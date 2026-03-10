import { BusinessObject, setView } from '@apexdesigner/dsl';

/**
 * Test Item Summary
 *
 * View that summarizes test items with their setting names.
 */
export class TestItemSummary extends BusinessObject {
  /** Id - Primary key from test_item */
  id!: number;

  /** Name - Item name */
  name?: string;

  /** Description - Item description */
  description?: string;

  /** Setting Name - Name of the referenced setting */
  settingName?: string;

  /** Item Count - Number of items with this setting */
  itemCount?: number;
}

setView(
  TestItemSummary,
  `
  SELECT
    ti.id,
    ti.name,
    ti.description,
    ts.name AS setting_name,
    counts.item_count
  FROM test_item ti
  LEFT JOIN test_setting ts ON ts.id = ti.test_setting_id
  LEFT JOIN (
    SELECT test_setting_id, COUNT(*)::INTEGER AS item_count
    FROM test_item
    GROUP BY test_setting_id
  ) counts ON counts.test_setting_id = ti.test_setting_id
`
);
