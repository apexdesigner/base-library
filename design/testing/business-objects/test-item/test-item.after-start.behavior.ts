import { addBehavior } from '@apexdesigner/dsl';
import { TestItem } from '@business-objects';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:testItemAfterStart');

/**
 * After Start
 *
 * Runs after the TestItem data source starts.
 */
addBehavior(
  TestItem,
  {
    type: 'After Start'
  },
  async function afterStart() {
    debug('TestItem after start');
  }
);
