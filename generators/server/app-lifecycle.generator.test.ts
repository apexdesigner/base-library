import { describe, it, expect } from 'vitest';
import { appLifecycleGenerator } from './app-lifecycle.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('appLifecycleGenerator', () => {
  describe('basic structure', () => {
    it('should output to server/src/app-behaviors/{name}.ts', () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'LoadSampleDesigns', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Lifecycle Behavior', stage: 'Running' },
            async function loadSampleDesigns() {}
          );
        `,
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const outputs = appLifecycleGenerator.outputs(metadata);

      expect(outputs).toEqual(['server/src/app-behaviors/load-sample-designs.ts']);
    });

    it('should generate exported async function with debug', async () => {
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
        `,
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appLifecycleGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import createDebug from "debug"');
      expect(result).toContain('const Debug = createDebug(');
      expect(result).toContain('export async function loadSampleDesigns()');
      expect(result).toContain('const debug = Debug.extend("loadSampleDesigns")');
      expect(result).toContain("console.log('loading')");
    });

    it('should skip class behaviors (non-lifecycle)', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'ComputeSha1', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior' },
            async function computeSha1(data: unknown): Promise<string> {
              return 'abc';
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appLifecycleGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toBe('');
    });
  });

  describe('imports', () => {
    it('should map @business-objects to relative paths', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'LoadSampleDesigns', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addAppBehavior(
            { type: 'Lifecycle Behavior', stage: 'Running' },
            async function loadSampleDesigns() {
              await ProcessDesign.find();
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appLifecycleGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { ProcessDesign } from "../business-objects/process-design.js"');
    });

    it('should pass through external package imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'LoadSampleDesigns', {
        sourceCode: `
          import fs from 'node:fs';
          import path from 'node:path';
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Lifecycle Behavior', stage: 'Running' },
            async function loadSampleDesigns() {
              fs.existsSync(path.join('.'));
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appLifecycleGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import fs from "node:fs"');
      expect(result).toContain('import path from "node:path"');
    });

    it('should map @app to App import', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'AfterStartSetup', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          import { App } from '@app';
          addAppBehavior(
            { type: 'Lifecycle Behavior', stage: 'Running' },
            async function afterStartSetup() {
              await App.someMethod();
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appLifecycleGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { App } from "../app.js"');
    });

    it('should skip @apexdesigner/dsl and vitest imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'LoadSampleDesigns', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          import { expect } from 'vitest';
          addAppBehavior(
            { type: 'Lifecycle Behavior', stage: 'Running' },
            async function loadSampleDesigns() {}
          );
        `,
      });

      const metadata = workspace.context.listMetadata('AppBehavior')[0];
      const result = (await appLifecycleGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('@apexdesigner/dsl');
      expect(result).not.toContain('vitest');
    });
  });
});
