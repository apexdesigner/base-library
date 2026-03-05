import { addBehavior } from '@apexdesigner/dsl';
import { User } from '@business-objects';
import { App } from '@app';
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
    httpMethod: 'Get'
  },
  async function currentUser() {
    const authCtx = App.auth.context?.getStore();
    debug('authCtx', authCtx);

    if (!authCtx?.user) return null;

    return authCtx.user;
  }
);
