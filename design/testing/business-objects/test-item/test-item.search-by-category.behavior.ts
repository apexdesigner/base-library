import { addBehavior } from '@apexdesigner/dsl';
import { Header } from '@apexdesigner/dsl';
import { TestItem } from '@business-objects';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:testItemSearchByCategory');

/**
 * Search By Category
 *
 * POST class behavior with a path param, header param, and body param.
 * Tests all three parameter sources together.
 */
addBehavior(
  TestItem,
  {
    type: 'Class',
    httpMethod: 'Post',
    path: '/api/test-items/categories/:categoryId/search'
  },
  async function searchByCategory(categoryId: number, authorization: Header<string>, filters: any) {
    debug('categoryId %j authorization %j filters %j', categoryId, authorization, filters);
    return { categoryId, authorized: !!authorization, filters };
  }
);
