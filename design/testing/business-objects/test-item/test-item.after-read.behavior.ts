import { addBehavior, addTest } from '@apexdesigner/dsl';
import { TestItem } from '@business-objects';
import { expect } from 'vitest';
import createDebug from 'debug';

const debug = createDebug('Test:TestItem:afterRead');

/**
 * Test Item After Read
 *
 * Sets a computed description suffix after reading test items.
 */
addBehavior(TestItem, { type: 'After Read' }, async function afterRead(instances: TestItem[]) {
  for (const item of instances) {
    debug('afterRead item %j', item.id);
  }
});

addTest('afterRead runs on find', async () => {
  const item = await TestItem.create({ name: 'afterRead test' });
  const results = await TestItem.find({ where: { id: item.id } });
  expect(results).toHaveLength(1);
  expect(results[0].name).toBe('afterRead test');
});

addTest('afterRead runs on findOne', async () => {
  const item = await TestItem.create({ name: 'afterRead findOne test' });
  const result = await TestItem.findOne({ where: { id: item.id } });
  expect(result).not.toBeNull();
  expect(result!.name).toBe('afterRead findOne test');
});

addTest('afterRead runs on findById', async () => {
  const item = await TestItem.create({ name: 'afterRead findById test' });
  const result = await TestItem.findById(item.id);
  expect(result.name).toBe('afterRead findById test');
});
