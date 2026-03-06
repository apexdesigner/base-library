import { addBehavior } from '@apexdesigner/dsl';
import { TestItem } from '@business-objects';

/**
 * Startup
 *
 * Logs the count of test items after server start.
 */
addBehavior(
  TestItem,
  {
    type: 'After Start'
  },
  async function startup() {
    const items = await TestItem.find();
    console.log('Found', items.length, 'items');
  }
);
