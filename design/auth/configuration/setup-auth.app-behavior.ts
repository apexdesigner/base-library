import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';
import { authConfigSchema } from '@server/schemas/interface-definitions/auth-config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { snakeCase } from 'change-case';
import { match } from '@server-node-modules/path-to-regexp';
import { publicRoutes } from '@server/routes/public-routes';
import { AsyncLocalStorage } from 'node:async_hooks';
import jwksRsa from 'jwks-rsa';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:Auth:setupAuth');

/**
 * Setup Auth
 *
 * Loads OIDC configuration from `auth-config.json` with environment variable
 * overrides and initializes authentication state on App.auth at startup.
 * Auth is enabled by default; set `AUTH_DISABLED=true` to disable.
 */
addAppBehavior(
  {
    type: 'Lifecycle Behavior',
    stage: 'Startup',
    sequence: 100
  },
  async function setupAuth() {
    debug('process.env.AUTH_DISABLED %j', process.env.AUTH_DISABLED);

    if (process.env.AUTH_DISABLED === 'true') {
      debug('disabled');

      return;
    }

    // Load base config from auth-config.json
    const configPath = resolve(import.meta.dirname, '..', '..', 'auth-config.json');
    debug('configPath %j', configPath);

    let config: Record<string, any> = {};
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
      debug('config %j', config);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        debug('auth-config.json not found');
      } else {
        throw new Error(`Failed to parse auth-config.json: ${err.message}`);
      }
    }

    // Override with env vars using schema keys (covers all properties, not just those in JSON)
    type ConfigKey = keyof typeof authConfigSchema.shape;
    const schemaKeys = Object.keys(authConfigSchema.shape) as ConfigKey[];
    debug('schemaKeys %j', schemaKeys);

    for (const key of schemaKeys) {
      const envKey = `AUTH_${snakeCase(key).toUpperCase()}`;
      debug('envKey %j', envKey);

      const envVal = process.env[envKey];
      debug('envVal %j', envVal);

      if (envVal !== undefined) {
        if (envVal === 'true' || envVal === 'false') {
          config[key] = envVal === 'true';
        } else if (!isNaN(Number(envVal))) {
          config[key] = Number(envVal);
        } else if (envVal.includes('[') && envVal.includes(']')) {
          config[key] = JSON.parse(envVal);
        } else {
          config[key] = envVal;
        }
        debug('config[%s] %j', key, config[key]);
      }
    }

    // Apply defaults for optional properties not yet set
    config.jwksUri ??= `${config.issuer}.well-known/jwks.json`;
    config.domain ??= config.issuer ? new URL(config.issuer).hostname : undefined;
    config.algorithms ??= ['RS256'];
    config.tokenCacheTTL ??= 3600;
    config.scopes ??= ['openid', 'profile', 'email'];
    debug('config after defaults %j', config);

    // Validate with Zod schema
    const result = authConfigSchema.safeParse(config);
    debug('result.success %j', result.success);

    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      debug('issues %j', issues);

      throw new Error(`Auth config validation failed: ${issues}. Set values in auth-config.json or via AUTH_* env vars, or set AUTH_DISABLED=true.`);
    }

    App.auth.config = result.data;
    debug('App.auth.config %j', App.auth.config);

    // Initialize auth context
    App.auth.context = new AsyncLocalStorage();

    // Initialize JWKS client
    App.auth.jwksClient = jwksRsa({
      jwksUri: config.jwksUri,
      cache: true,
      cacheMaxAge: config.tokenCacheTTL * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10
    });
    debug('App.auth.jwksClient %j', App.auth.jwksClient);

    // Initialize caches
    App.auth.subEmailCache = new Map();
    App.auth.inFlightRequests = new Map();

    // Build public route matchers from generated routes
    const matchers = publicRoutes.map(route => match(route));
    debug('matchers.length %j', matchers.length);

    App.auth.isPublicRoute = (path: string) => matchers.some(m => m(path));
  }
);
