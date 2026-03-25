import { addTestFixture } from '@apexdesigner/dsl';
import { TestItem } from '@business-objects';

/**
 * Basic
 *
 * Creates a basic test item with standard field values.
 */
addTestFixture(
  TestItem,
  async function basic() {
    const testItem = await TestItem.create({
      name: 'Basic Test Item',
      email: 'test@example.com',
      description: 'A basic test item for testing.',
      dueDate: new Date('2026-06-01'),
    });
    return testItem;
  },
);
