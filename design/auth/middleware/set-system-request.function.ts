import { addFunction, addTest } from '@apexdesigner/dsl';
import { App } from '@app';
import { setSystemRequest, isSystemRequest } from '@functions';
import { AsyncLocalStorage } from 'node:async_hooks';
import createDebug from 'debug';
import { expect } from 'vitest';

const debug = createDebug('BaseLibrary:Auth:setSystemRequest');

/**
 * Set System Request
 *
 * Runs a callback within a system request context where
 * role checking is bypassed. The context is scoped to the
 * callback and does not affect other concurrent requests.
 *
 * @param callback - The function to run as a system request
 * @returns The return value of the callback
 */
addFunction({ layer: 'Server' }, async function setSystemRequest<T>(
  callback: () => Promise<T>,
): Promise<T> {
  debug('entering system request context');

  const currentStore = App.auth.context?.getStore();
  const store = { ...currentStore, systemRequest: true };

  return App.auth.context.run(store as any, callback);
});

addTest('should set systemRequest in context for callback', async () => {
  App.auth.context = new AsyncLocalStorage();
  App.auth.context.run({ user: {} } as any, async () => {
    await setSystemRequest(async () => {
      expect(isSystemRequest()).toBe(true);
    });
  });
});

addTest('should preserve existing context properties', async () => {
  App.auth.context = new AsyncLocalStorage();
  const user = { id: 1 };
  App.auth.context.run({ user } as any, async () => {
    await setSystemRequest(async () => {
      const store = App.auth.context.getStore();
      expect(store.user.id).toBe(1);
      expect(store.systemRequest).toBe(true);
    });
  });
});

addTest('should not affect context outside callback', async () => {
  App.auth.context = new AsyncLocalStorage();
  App.auth.context.run({ user: {} } as any, async () => {
    await setSystemRequest(async () => {});
    expect(isSystemRequest()).toBe(false);
  });
});
