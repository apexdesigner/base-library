import { addAppBehavior } from '@apexdesigner/dsl';
import { Header } from '@apexdesigner/dsl';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:lookupByCategory');

/**
 * Lookup By Category
 *
 * GET endpoint with a path param and a header param.
 * Tests that path params come from the URL and header params come from headers.
 */
addAppBehavior(
  {
    type: 'Class Behavior',
    httpMethod: 'Get',
    path: '/api/categories/:categoryId/lookup'
  },
  async function lookupByCategory(categoryId: number, authorization: Header<string>) {
    debug('categoryId %j authorization %j', categoryId, authorization);
    return { categoryId, authorized: !!authorization };
  }
);
