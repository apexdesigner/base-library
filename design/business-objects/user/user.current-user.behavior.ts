import { addBehavior } from '@apexdesigner/dsl';
import { User } from '@business-objects';
import { App } from '@app';
import { Authenticated } from '@roles';
import createDebug from 'debug';

const debug = createDebug('User:currentUser');

/**
 * Current User
 *
 * Returns the authenticated user with role assignments and roles included.
 */
addBehavior(
  User,
  {
    type: 'Class',
    httpMethod: 'Get',
    roles: [Authenticated],
  },
  async function currentUser() {
    const authContext = App.auth.context?.getStore();
    debug('authContext', authContext);

    if (!authContext?.user) return null;

    return authContext.user;
  }
);
