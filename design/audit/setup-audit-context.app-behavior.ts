import createDebug from 'debug';
import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';
import { AsyncLocalStorage } from 'node:async_hooks';

const debug = createDebug('BaseLibrary:Audit:setupAuditContext');

/**
 * Setup Audit Context
 *
 * Initializes the audit AsyncLocalStorage at startup.
 */
addAppBehavior(
  {
    type: 'Lifecycle Behavior',
    stage: 'Startup',
    sequence: 200
  },
  async function initAuditContext() {
    App.auditProperties.context = new AsyncLocalStorage();
    debug('audit context initialized');
  }
);
