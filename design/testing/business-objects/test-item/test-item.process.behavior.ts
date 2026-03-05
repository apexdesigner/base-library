import { addBehavior } from '@apexdesigner/dsl';
import { TestItem } from '@business-objects';

addBehavior(
  TestItem,
  {
    type: 'Class',
    httpMethod: 'Post'
  },
  async function process(options: { name: string; count?: number }) {}
);
