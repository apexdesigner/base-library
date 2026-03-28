import { addBehavior } from '@apexdesigner/dsl';
import { TestItem } from '@business-objects';
import { TestSummary } from '@interface-definitions';

/**
 * Get Summaries
 *
 * Returns summary information for all test items.
 * Tests that interface definition return types generate correct imports.
 */
addBehavior(TestItem, { type: 'Class', httpMethod: 'Get' }, async function getSummaries(): Promise<TestSummary[]> {
  const items = await TestItem.find();
  return items.map(item => ({
    name: item.name || '',
    count: 1,
    status: 'active'
  }));
});
