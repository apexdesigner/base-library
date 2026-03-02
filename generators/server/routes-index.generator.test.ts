import { describe, it, expect } from 'vitest';
import { routesIndexGenerator } from './routes-index.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('routesIndexGenerator', () => {
  describe('app behavior routes', () => {
    it('should include app-behaviors route when app behaviors with httpMethod exist', async () => {
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
      const result = await routesIndexGenerator.generate(metadata, workspace.context);
      const content = typeof result === 'string' ? result : '';

      expect(content).toContain('app_behaviorsRouter');
      expect(content).toContain('router.use("/", app_behaviorsRouter)');
    });

    it('should not include app-behaviors route when no qualifying app behaviors', async () => {
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
      const result = await routesIndexGenerator.generate(metadata, workspace.context);
      const content = typeof result === 'string' ? result : '';

      expect(content).not.toContain('app_behaviors');
    });
  });
});
