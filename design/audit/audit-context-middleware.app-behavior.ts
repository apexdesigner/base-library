import createDebug from 'debug';
import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';

const debug = createDebug('BaseLibrary:Audit:auditContextMiddleware');

/**
 * Audit Context Middleware
 *
 * Wraps each request with an audit AsyncLocalStorage context for passing state between lifecycle hooks.
 */
addAppBehavior(
  {
    type: 'Middleware',
    sequence: 150,
  },
  async function auditContextMiddleware(req: any, res: any, next: () => void) {
    debug('wrapping request');

    App.auditProperties.context!.run({}, () => next());
  },
);
