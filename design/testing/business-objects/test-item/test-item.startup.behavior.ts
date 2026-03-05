import { addBehavior } from '@apexdesigner/dsl';
import { TestItem } from '@business-objects';

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
