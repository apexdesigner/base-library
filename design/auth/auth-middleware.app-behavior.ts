import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';
import jwt from 'jsonwebtoken';
import createDebug from 'debug';
import { User } from '@business-objects';

const debug = createDebug('BaseLibrary:Auth:authMiddleware');

/**
 * Auth Middleware
 *
 * Validates JWT bearer tokens, resolves the user by email,
 * and stores the authenticated context in AsyncLocalStorage.
 */
addAppBehavior(
  {
    type: 'Middleware',
    sequence: 100
  },
  async function authMiddleware(req: any, res: any, next: () => void) {
    debug('process.env.AUTH_DISABLED %j', process.env.AUTH_DISABLED);

    if (process.env.AUTH_DISABLED === 'true') {
      next();
      return;
    }

    debug('req.path %j', req.path);

    // Allow public routes through without authentication
    if (App.auth.isPublicRoute?.(req.path)) {
      debug('public route %j', req.path);

      next();
      return;
    }

    const config = App.auth.config;
    debug('config %j', config);

    if (!config) {
      res.status(500).json({ error: 'Auth config not initialized', code: 'AUTH_NOT_CONFIGURED' });
      return;
    }

    // Extract bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      debug('authHeader %j', null);
      res.status(401).json({ error: 'No authorization token provided', code: 'AUTH_NO_TOKEN' });
      return;
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      res.status(401).json({ error: 'No authorization token provided', code: 'AUTH_NO_TOKEN' });
      return;
    }
    const token = parts[1];

    try {
      // Decode and verify JWT
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.header.kid) {
        res.status(401).json({ error: 'Invalid token format', code: 'AUTH_INVALID_FORMAT' });
        return;
      }

      let signingKey: string;
      try {
        const key = await App.auth.jwksClient.getSigningKey(decoded.header.kid);
        signingKey = key.getPublicKey();
      } catch {
        res.status(503).json({ error: 'Authentication service unavailable', code: 'AUTH_SERVICE_UNAVAILABLE' });
        return;
      }

      const payload = jwt.verify(token, signingKey, {
        algorithms: config.algorithms as jwt.Algorithm[],
        issuer: config.issuer,
        audience: config.audience
      }) as any;

      if (!payload.sub) {
        res.status(401).json({ error: 'Missing required claim: sub', code: 'AUTH_MISSING_CLAIM' });
        return;
      }

      // Extract tenant ID
      let tenantId: string | undefined = payload.tenant_id;
      if (!tenantId) {
        for (const key of Object.keys(payload)) {
          if (key.endsWith('/tenant_id') || key.endsWith(':tenant_id')) {
            tenantId = payload[key] as string;
            break;
          }
        }
      }
      if (config.requireTenantId && !tenantId) {
        res.status(401).json({ error: 'Missing required claim: tenant_id', code: 'AUTH_MISSING_TENANT' });
        return;
      }

      // Determine token type
      const tokenType = payload.gty === 'client-credentials' ? 'm2m' : 'user';
      const accessTokenClaims = { ...payload, tokenType };

      // Resolve email from sub — check cache first, then call userinfo endpoint
      let email = App.auth.subEmailCache?.get(payload.sub);
      if (!email) {
        debug('cache miss for %j, fetching userinfo', payload.sub);
        const userinfoUrl = config.issuer.endsWith('/') ? `${config.issuer}userinfo` : `${config.issuer}/userinfo`;
        const response = await fetch(userinfoUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const profile = await response.json();
          email = profile.email;
          if (email) {
            App.auth.subEmailCache?.set(payload.sub, email);
          }
        }
      }
      debug('email %j', email);

      if (!email) {
        res.status(401).json({ error: 'Could not resolve user email', code: 'AUTH_NO_EMAIL' });
        return;
      }

      // Find or create user by email
      let user = await User.findOne({
        where: { email },
        include: { roleAssignments: { include: { role: {} } } }
      });

      if (!user) {
        user = await User.create({ email });
        debug('created user %j', user.id);
      }
      debug('user %j', user);

      const roles = user ? (user.roleAssignments || []).map((ra: any) => ra.role).filter(Boolean) : [];
      debug('roles %j', roles);

      // Set on request
      req.user = user;
      req.accessToken = accessTokenClaims;
      req.tenantId = tenantId;

      // Run downstream handlers within AsyncLocalStorage context
      App.auth.context.run({ user, accessToken: accessTokenClaims, tenantId, roles }, () => {
        next();
      });
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired', code: 'AUTH_TOKEN_EXPIRED' });
        return;
      }
      if (err.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid token', code: 'AUTH_INVALID_TOKEN' });
        return;
      }
      debug('error %O', err);
      res.status(401).json({ error: 'Authentication failed', code: 'AUTH_FAILED' });
    }
  }
);
