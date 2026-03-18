import { addFunction, addTest } from '@apexdesigner/dsl';
import { App } from '@app';
import { isImporting } from '@functions';
import { AsyncLocalStorage } from 'node:async_hooks';
import createDebug from 'debug';
import { expect } from 'vitest';

const debug = createDebug('BaseLibrary:ExportImport:isImporting');

/**
 * Is Importing
 *
 * Returns whether the current request is running within an import context.
 * Behaviors can check this flag to decide whether to skip side effects
 * like sending notifications or triggering workflows.
 *
 * @returns True if the current request is within an import operation
 */
addFunction({ layer: 'Server' }, function isImporting(): boolean {
  const store = App.auth.context?.getStore();
  debug('store %j', !!store);

  const result = store?.importing === true;
  debug('importing %j', result);

  return result;
});

addTest('should return true when importing is set', async () => {
  App.auth.context = new AsyncLocalStorage();
  App.auth.context.run({ importing: true } as any, () => {
    expect(isImporting()).toBe(true);
  });
});

addTest('should return false when importing is not set', async () => {
  App.auth.context = new AsyncLocalStorage();
  App.auth.context.run({ user: {} } as any, () => {
    expect(isImporting()).toBe(false);
  });
});

addTest('should return false when no auth context exists', async () => {
  App.auth.context = new AsyncLocalStorage();
  expect(isImporting()).toBe(false);
});
