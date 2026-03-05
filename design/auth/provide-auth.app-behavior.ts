import { addAppBehavior } from '@apexdesigner/dsl';
import { EnvironmentProviders } from '@angular/core';
import { provideAuth as provideOidcAuth, StsConfigLoader, StsConfigHttpLoader, OpenIdConfiguration } from 'angular-auth-oidc-client';
import { from } from 'rxjs';
import { AuthConfig } from '@interface-definitions';
import createDebug from 'debug';

const debug = createDebug('provideAuth');

addAppBehavior(
  {
    type: 'Provider'
  },
  function provideAuth(): EnvironmentProviders {
    debug('provideAuth called');
    const loadConfig = async (): Promise<OpenIdConfiguration> => {
      try {
        const response = await fetch('/api/auth/config');
        debug('response.ok', response.ok);

        if (!response.ok) {
          debug('config endpoint failed');
          return {};
        }

        const config: AuthConfig | null = await response.json();
        debug('config', config);

        if (!config) {
          debug('auth disabled');
          return {};
        }

        const oidc: OpenIdConfiguration = {
          authority: `https://${config.domain}`,
          redirectUrl: window.location.origin,
          postLogoutRedirectUri: window.location.origin,
          clientId: config.clientId,
          scope: (config.scopes ?? ['openid', 'profile', 'email']).join(' '),
          responseType: 'code',
          silentRenew: true,
          useRefreshToken: true,
          renewTimeBeforeTokenExpiresInSeconds: 30,
          customParamsAuthRequest: { audience: config.audience },
          useCustomAuth0Domain: config.useCustomAuth0Domain
        };

        if (config.logoutUrl) {
          const logoutUrl = new URL(config.logoutUrl);
          logoutUrl.searchParams.set('client_id', config.clientId);
          logoutUrl.searchParams.set('returnTo', window.location.origin);
          oidc.authWellknownEndpoints = {
            endSessionEndpoint: logoutUrl.toString()
          };
        }

        return oidc;
      } catch {
        debug('config not available');
        return {};
      }
    };

    const environmentProviders: EnvironmentProviders = provideOidcAuth({
      loader: {
        provide: StsConfigLoader,
        useFactory: () => new StsConfigHttpLoader(from(loadConfig()))
      }
    });

    return environmentProviders;
  }
);
