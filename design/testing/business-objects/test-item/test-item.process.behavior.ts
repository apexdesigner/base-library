import { addBehavior } from '@apexdesigner/dsl';
import { TestItem } from '@business-objects';

/**
 * Process
 *
 * Processes a test item with the given options.
 */
addBehavior(
  TestItem,
  {
    type: 'Class',
    httpMethod: 'Post'
  },
  async function process(options: { name: string; count?: number }) {}
);
