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
});
