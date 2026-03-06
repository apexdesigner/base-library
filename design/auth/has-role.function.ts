import { addFunction, addTest } from '@apexdesigner/dsl';
import { App } from '@app';
import { hasRole } from '@functions';
import { AsyncLocalStorage } from 'node:async_hooks';
import { expect } from 'vitest';

/**
 * Has Role
 *
 * Checks if the current authenticated user has a specific role.
 * Reads from the AsyncLocalStorage auth context set by the auth middleware.
 *
 * @param roleName - The role name to check
 * @returns True if the current user has the role
 */
addFunction(
  { layer: 'Server' },
  function hasRole(roleName: string): boolean {
    const store = App.auth.context?.getStore();
    return store?.roles?.some((r: any) => r.name === roleName) ?? false;
  },
);

addTest('should return true when user has the role', async () => {
  App.auth.context = new AsyncLocalStorage();
  const roles = [{ name: 'Administrator' }] as any;
  App.auth.context.run({ roles } as any, () => {
    expect(hasRole('Administrator')).toBe(true);
  });
});

addTest('should return false when user does not have the role', async () => {
  App.auth.context = new AsyncLocalStorage();
  const roles = [{ name: 'Viewer' }] as any;
  App.auth.context.run({ roles } as any, () => {
    expect(hasRole('Administrator')).toBe(false);
  });
});

addTest('should return false when no auth context exists', async () => {
  App.auth.context = new AsyncLocalStorage();
  expect(hasRole('Administrator')).toBe(false);
});

addTest('should return false when roles array is empty', async () => {
  App.auth.context = new AsyncLocalStorage();
  App.auth.context.run({ roles: [] } as any, () => {
    expect(hasRole('Administrator')).toBe(false);
  });
});
