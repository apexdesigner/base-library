import { addFunction, addTest } from '@apexdesigner/dsl';
import { App } from '@app';
import { isSystemRequest } from '@functions';
import { AsyncLocalStorage } from 'node:async_hooks';
import createDebug from 'debug';
import { expect } from 'vitest';

const debug = createDebug('BaseLibrary:Auth:isSystemRequest');

/**
 * Is System Request
 *
 * Returns whether the current request is a system request,
 * meaning role checking should be bypassed.
 *
 * @returns True if the current request is a system request
 */
addFunction({ layer: 'Server' }, function isSystemRequest(): boolean {
  const store = App.auth.context?.getStore();
  debug('store %j', !!store);

  const result = store?.systemRequest === true;
  debug('systemRequest %j', result);

  return result;
});

addTest('should return true when systemRequest is set', async () => {
  App.auth.context = new AsyncLocalStorage();
  App.auth.context.run({ systemRequest: true } as any, () => {
    expect(isSystemRequest()).toBe(true);
  });
});

addTest('should return false when systemRequest is not set', async () => {
  App.auth.context = new AsyncLocalStorage();
  App.auth.context.run({ user: {} } as any, () => {
    expect(isSystemRequest()).toBe(false);
  });
});

addTest('should return false when no auth context exists', async () => {
  App.auth.context = new AsyncLocalStorage();
  expect(isSystemRequest()).toBe(false);
});
