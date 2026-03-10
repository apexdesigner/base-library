import { describe, it, expect } from 'vitest';
import { serverGenerator } from './server.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('serverGenerator', () => {
  it('should import and call BO After Start behaviors', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Behavior', 'TestItemStartup', {
      sourceCode: `
        import { addBehavior } from '@apexdesigner/dsl';
        import { TestItem } from '@business-objects';
        addBehavior(
          TestItem,
          { type: 'After Start' },
          async function startup() {
            await TestItem.find();
          }
        );
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await serverGenerator.generate(metadata, workspace.context)) as Map<string, string>;

    const indexTs = result.get('server/src/index.ts')!;

    expect(indexTs).toContain('import { startup } from "./business-objects/test-item.startup.js"');
    expect(indexTs).toContain('await startup()');
  });

  it('should import and call app After Start behaviors', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'LoadSampleDesigns', {
      sourceCode: `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Lifecycle Behavior', stage: 'Running' },
          async function loadSampleDesigns() {
            console.log('loading');
          }
        );
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await serverGenerator.generate(metadata, workspace.context)) as Map<string, string>;

    const indexTs = result.get('server/src/index.ts')!;

    expect(indexTs).toContain('import { loadSampleDesigns } from "./app-behaviors/load-sample-designs.js"');
    expect(indexTs).toContain('await loadSampleDesigns()');
  });

  it('should import both app and BO After Start behaviors', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'LoadSampleDesigns', {
      sourceCode: `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Lifecycle Behavior', stage: 'Running' },
          async function loadSampleDesigns() {}
        );
      `
    });
    workspace.addMetadata('Behavior', 'TestItemStartup', {
      sourceCode: `
        import { addBehavior } from '@apexdesigner/dsl';
        import { TestItem } from '@business-objects';
        addBehavior(
          TestItem,
          { type: 'After Start' },
          async function startup() {}
        );
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await serverGenerator.generate(metadata, workspace.context)) as Map<string, string>;

    const indexTs = result.get('server/src/index.ts')!;

    expect(indexTs).toContain('import { loadSampleDesigns } from "./app-behaviors/load-sample-designs.js"');
    expect(indexTs).toContain('import { startup } from "./business-objects/test-item.startup.js"');
    expect(indexTs).toContain('await loadSampleDesigns()');
    expect(indexTs).toContain('await startup()');
  });

  describe('static client file serving', () => {
    it('should serve built client files with express.static', async () => {
      const workspace = createSimpleMockWorkspace();

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await serverGenerator.generate(metadata, workspace.context)) as Map<string, string>;

      const indexTs = result.get('server/src/index.ts')!;

      expect(indexTs).toContain('express.static(');
      expect(indexTs).toContain('import { existsSync }');
    });

    it('should only serve when client directory exists', async () => {
      const workspace = createSimpleMockWorkspace();

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await serverGenerator.generate(metadata, workspace.context)) as Map<string, string>;

      const indexTs = result.get('server/src/index.ts')!;

      expect(indexTs).toContain('existsSync(clientDir)');
    });

    it('should add SPA fallback to serve index.html for non-API GET requests', async () => {
      const workspace = createSimpleMockWorkspace();

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await serverGenerator.generate(metadata, workspace.context)) as Map<string, string>;

      const indexTs = result.get('server/src/index.ts')!;

      expect(indexTs).toContain('index.html');
      expect(indexTs).toContain('!req.path.startsWith("/api")');
    });

    it('should place static and SPA middleware before auth middleware', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'AuthMiddleware', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Middleware' },
            function authMiddleware(req: any, res: any, next: any) { next(); }
          );
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await serverGenerator.generate(metadata, workspace.context)) as Map<string, string>;

      const indexTs = result.get('server/src/index.ts')!;

      const staticIndex = indexTs.indexOf('express.static(');
      const spaIndex = indexTs.indexOf('sendFile(indexHtml)');
      const authIndex = indexTs.indexOf('app.use(authMiddleware)');
      expect(staticIndex).toBeGreaterThan(-1);
      expect(spaIndex).toBeGreaterThan(-1);
      expect(staticIndex).toBeLessThan(authIndex);
      expect(spaIndex).toBeLessThan(authIndex);
    });
  });
});
