import { addAppBehavior } from '@apexdesigner/dsl';
import { Header } from '@apexdesigner/dsl';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:submitWithToken');

/**
 * Submit With Token
 *
 * POST endpoint with a header param and a body param.
 * Tests that header params come from headers and body params from the request body.
 */
addAppBehavior(
  {
    type: 'Class Behavior',
    httpMethod: 'Post',
    path: '/api/submit-with-token'
  },
  async function submitWithToken(apiKey: Header<string>, payload: any) {
    debug('apiKey %j payload %j', apiKey, payload);
    return { received: true, hasKey: !!apiKey, payload };
  }
);
