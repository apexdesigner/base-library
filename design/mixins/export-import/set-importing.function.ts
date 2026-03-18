import { addFunction, addTest } from '@apexdesigner/dsl';
import { App } from '@app';
import { setImporting, isImporting } from '@functions';
import { AsyncLocalStorage } from 'node:async_hooks';
import createDebug from 'debug';
import { expect } from 'vitest';

const debug = createDebug('BaseLibrary:ExportImport:setImporting');

/**
 * Set Importing
 *
 * Runs a callback within an import context. Behaviors can check
 * isImporting() to decide whether to skip side effects like
 * sending notifications or triggering workflows.
 *
 * @param callback - The function to run within the import context
 * @returns The return value of the callback
 */
addFunction({ layer: 'Server' }, async function setImporting<T>(
  callback: () => Promise<T>,
): Promise<T> {
  debug('entering import context');

  const currentStore = App.auth.context?.getStore();
  const store = { ...currentStore, importing: true };

  return App.auth.context.run(store as any, callback);
});

addTest('should set importing in context for callback', async () => {
  App.auth.context = new AsyncLocalStorage();
  App.auth.context.run({ user: {} } as any, async () => {
    await setImporting(async () => {
      expect(isImporting()).toBe(true);
    });
  });
});

addTest('should preserve existing context properties', async () => {
  App.auth.context = new AsyncLocalStorage();
  const user = { id: 1 };
  App.auth.context.run({ user } as any, async () => {
    await setImporting(async () => {
      const store = App.auth.context.getStore();
      expect(store.user.id).toBe(1);
      expect(store.importing).toBe(true);
    });
  });
});

addTest('should not affect context outside callback', async () => {
  App.auth.context = new AsyncLocalStorage();
  App.auth.context.run({ user: {} } as any, async () => {
    await setImporting(async () => {});
    expect(isImporting()).toBe(false);
  });
});
