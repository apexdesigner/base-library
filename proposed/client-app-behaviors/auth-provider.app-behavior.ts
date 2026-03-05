import { addAppBehavior } from "@apexdesigner/dsl";
import { EnvironmentProviders } from "@angular/core";
import {
  provideAuth,
  StsConfigLoader,
  StsConfigStaticLoader,
  OpenIdConfiguration,
} from "angular-auth-oidc-client";
import { SpaConfig } from "@interface-definitions";
import createDebug from "debug";

const debug = createDebug("authProvider");

addAppBehavior(
  {
    type: "Provider",
  },
  function authProvider(): EnvironmentProviders {
    const loadConfig = async (): Promise<OpenIdConfiguration> => {
      try {
        const response = await fetch("/api/auth/config");
        const config: SpaConfig = await response.json();
        debug("config", config);

        const oidc: OpenIdConfiguration = {
          authority: `https://${config.domain}`,
          redirectUrl: window.location.origin,
          postLogoutRedirectUri: window.location.origin,
          clientId: config.clientId,
          scope: config.scopes.join(" "),
          responseType: "code",
          silentRenew: true,
          useRefreshToken: true,
          renewTimeBeforeTokenExpiresInSeconds: 30,
          customParamsAuthRequest: { audience: config.audience },
        };

        if (config.logoutUrl) {
          const logoutUrl = new URL(config.logoutUrl);
          logoutUrl.searchParams.set("client_id", config.clientId);
          logoutUrl.searchParams.set("returnTo", window.location.origin);
          oidc.authWellknownEndpoints = {
            endSessionEndpoint: logoutUrl.toString(),
          };
        }

        return oidc;
      } catch {
        debug("config not available");
        return {} as OpenIdConfiguration;
      }
    };

    const environmentProviders: EnvironmentProviders = provideAuth({
      loader: {
        provide: StsConfigLoader,
        useFactory: () => new StsConfigStaticLoader(loadConfig()),
      },
    });

    return environmentProviders;
  },
);
