import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';
import { Everyone } from '@roles';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:Auth:getAuthConfig');

/**
 * Get Auth Config
 *
 * Public endpoint that returns the client-side OIDC configuration.
 * Used by the SPA to initialize the authentication library.
 */
addAppBehavior(
  {
    type: 'Class Behavior',
    httpMethod: 'Get',
    path: '/api/auth/config',
    roles: [Everyone]
  },
  async function getAuthConfig() {
    const config = App.auth.config;
    debug('config %j', config);

    if (!config) return null;

    return {
      domain: config.domain,
      clientId: config.clientId,
      audience: config.audience,
      scopes: config.scopes,
      logoutUrl: config.logoutUrl,
      useCustomAuth0Domain: config.useCustomAuth0Domain
    };
  }
);
