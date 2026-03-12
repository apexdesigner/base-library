import { describe, it, expect } from 'vitest';
import { appBehaviorRouteGenerator } from './app-behavior-route.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('appBehaviorRouteGenerator', () => {
  describe('route generation', () => {
    it('should generate a route with correct HTTP method and path', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'SystemHealthCheck', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
            async function systemHealthCheck() {
              return { status: 'ok' };
            }
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('router.get("/health"');
      expect(content).toContain('App.systemHealthCheck()');
    });

    it('should strip /api prefix from path', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'SystemHealthCheck', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
            async function systemHealthCheck() {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('"/health"');
      expect(content).not.toContain('"/api/health"');
    });

    it('should default path to kebab-case behavior name when no path specified', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'GetActiveOrders', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Get' },
            async function getActiveOrders() {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('"/get-active-orders"');
    });

    it('should pass req.body when behavior has parameters', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'SearchOrders', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Post' },
            async function searchOrders(query: any) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('App.searchOrders(req.body)');
    });

    it('should not pass req.body when behavior has no parameters', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'SystemHealthCheck', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Get' },
            async function systemHealthCheck() {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('App.systemHealthCheck()');
      expect(content).not.toContain('req.body');
    });

    it('should skip behaviors without httpMethod', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'InitCache', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Lifecycle Behavior', lifecycleStage: 'start' },
            async function initializeCache() {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('export default router');
      expect(content).not.toContain('App.');
    });

    it('should generate multiple routes when multiple app behaviors exist', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'SystemHealthCheck', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
            async function systemHealthCheck() {}
          );
        `
      });
      workspace.addMetadata('AppBehavior', 'SearchOrders', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Post' },
            async function searchOrders(query: any) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('router.get("/health"');
      expect(content).toContain('router.post("/search-orders"');
    });
  });

  describe('parameter sources', () => {
    it('should extract path parameters from req.params', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'ShipOrder', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Post', path: '/api/orders/:orderId/ship' },
            async function shipOrder(orderId: number, details: any) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('req.params.orderId');
      expect(content).not.toContain('req.body.orderId');
    });

    it('should extract Header<T> parameters from req.headers', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'ShipOrder', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          import { Header } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Post' },
            async function shipOrder(authorization: Header<string>, details: any) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('req.headers["authorization"]');
      expect(content).not.toContain('req.body.authorization');
    });

    it('should pass mixed path, header, and body args in correct order', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'ShipOrder', {
        sourceCode: `
          import { addAppBehavior, Header } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Post', path: '/api/orders/:orderId/ship' },
            async function shipOrder(orderId: number, authorization: Header<string>, notes: string) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('App.shipOrder(req.params.orderId, req.headers["authorization"], req.body.notes)');
    });

    it('should pass single body object param as req.body when mixed with path params', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'ShipOrder', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Post', path: '/api/orders/:orderId/ship' },
            async function shipOrder(orderId: number, details: any) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('App.shipOrder(req.params.orderId, req.body)');
    });
  });

  describe('role enforcement', () => {
    it('should add missingRole check when roles are specified', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'AdminReport', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          import { Administrator } from '@roles';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Get', roles: [Administrator] },
            async function adminReport() {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).toContain('import { missingRole } from "./missing-role.js"');
      expect(content).toContain('if (missingRole(res, "Administrator")) return;');
    });

    it('should not add missingRole for Everyone role', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'GetConfig', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          import { Everyone } from '@roles';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Get', roles: [Everyone] },
            async function getConfig() {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).not.toContain('missingRole');
    });

    it('should not add missingRole when no roles specified', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'HealthCheck', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior', httpMethod: 'Get' },
            async function healthCheck() {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appBehaviorRouteGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const content = result.get('server/src/routes/app-behaviors.ts')!;

      expect(content).not.toContain('missingRole');
    });
  });
});
