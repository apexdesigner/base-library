import { addBehavior } from '@apexdesigner/dsl';
import { Header } from '@apexdesigner/dsl';
import { TestItem } from '@business-objects';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:testItemExport');

/**
 * Export
 *
 * GET instance behavior with a header param.
 * Tests that header params are extracted from request headers.
 */
addBehavior(
  TestItem,
  {
    type: 'Instance',
    httpMethod: 'Get',
    metadata: { category: 'export' }
  },
  async function exportItem(testItem: TestItem, accept: Header<string>) {
    debug('testItem.id %j accept %j', testItem.id, accept);
    return { id: testItem.id, name: testItem.name, format: accept };
  }
);
