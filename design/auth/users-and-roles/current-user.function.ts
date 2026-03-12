import { addFunction, addTest } from '@apexdesigner/dsl';
import { App } from '@app';
import { currentUser } from '@functions';
import { User } from '@business-objects';
import { AsyncLocalStorage } from 'node:async_hooks';
import createDebug from 'debug';
import { expect } from 'vitest';

const debug = createDebug('BaseLibrary:Auth:currentUser');

/**
 * Current User
 *
 * Returns the authenticated user from the AsyncLocalStorage auth context.
 * Throws if no authenticated user is present in the context.
 *
 * @returns The current authenticated user
 */
addFunction({ layer: 'Server' }, function currentUser(): User {
  const store = App.auth.context?.getStore();
  debug('store %j', !!store);

  const user = store?.user;
  debug('user %j', user?.id);

  if (!user) {
    throw new Error('Not authenticated');
  }

  return user;
});

addTest('should return the user from auth context', async () => {
  App.auth.context = new AsyncLocalStorage();
  const user = { id: 1, email: 'admin@test.com' } as any;
  App.auth.context.run({ user } as any, () => {
    const result = currentUser();
    expect(result.id).toBe(1);
    expect(result.email).toBe('admin@test.com');
  });
});

addTest('should throw when no auth context exists', async () => {
  App.auth.context = new AsyncLocalStorage();
  expect(() => currentUser()).toThrow('Not authenticated');
});

addTest('should throw when user is not set in context', async () => {
  App.auth.context = new AsyncLocalStorage();
  App.auth.context.run({ roles: [] } as any, () => {
    expect(() => currentUser()).toThrow('Not authenticated');
  });
});
