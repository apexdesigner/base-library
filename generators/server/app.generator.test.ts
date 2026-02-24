import { describe, it, expect } from 'vitest';
import { appGenerator } from './app.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('appGenerator', () => {
  describe('basic structure', () => {
    it('should generate an App class with debug setup', async () => {
      const workspace = createSimpleMockWorkspace();

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import createDebug from "debug"');
      expect(result).toContain('const Debug = createDebug(');
      expect(result).toContain('export class App {');
    });

    it('should output to server/src/app.ts', () => {
      const outputs = appGenerator.outputs({ name: 'MyProject' } as any);
      expect(outputs).toEqual(['server/src/app.ts']);
    });
  });

  describe('class behaviors', () => {
    it('should inline class behavior as static method', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'ComputeSha1', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior' },
            async function computeSha1(data: unknown): Promise<string> {
              return 'abc123';
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static async computeSha1(data: unknown) {');
      expect(result).toContain('const debug = Debug.extend("computeSha1")');
      expect(result).toContain("return 'abc123'");
    });

    it('should exclude lifecycle app behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'AfterStart', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { lifecycleStage: 'After Start' },
            async function afterStart() {
              console.log('started');
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('afterStart');
    });
  });

  describe('behavior imports', () => {
    it('should pass through external package imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'ComputeSha1', {
        sourceCode: `
          import { createHash } from 'node:crypto';
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior' },
            async function computeSha1(data: unknown): Promise<string> {
              return createHash('sha1').update(JSON.stringify(data)).digest('hex');
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { createHash } from "node:crypto"');
    });

    it('should pass through default imports from external packages', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'GenerateAnalysis', {
        sourceCode: `
          import ts from 'typescript';
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior' },
            async function generateAnalysis(process: any): Promise<any> {
              return ts.transpileModule('code', {});
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import ts from "typescript"');
    });

    it('should map @business-objects imports to relative paths', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {}
        `,
      });
      workspace.addMetadata('AppBehavior', 'SomeAppBehavior', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addAppBehavior(
            { type: 'Class Behavior' },
            async function someAppBehavior() {
              const designs = await ProcessDesign.find();
              return designs;
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { ProcessDesign } from "./business-objects/process-design.js"');
    });

    it('should skip @project imports (self-reference)', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'PreprocessJson', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          import { App } from '@project';
          addAppBehavior(
            { type: 'Class Behavior' },
            async function preprocessJson(value: unknown): Promise<unknown> {
              return App.preprocessJson(value);
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('import { App }');
      // Body should still work because App.preprocessJson is a self-reference
      expect(result).toContain('App.preprocessJson(value)');
    });

    it('should skip vitest imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'ComputeSha1', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          import { expect } from 'vitest';
          addAppBehavior(
            { type: 'Class Behavior' },
            async function computeSha1(data: unknown): Promise<string> {
              return 'abc';
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('vitest');
    });

    it('should deduplicate imports across multiple behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'BehaviorA', {
        sourceCode: `
          import { createHash } from 'node:crypto';
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior' },
            async function behaviorA() {
              return createHash('sha1');
            }
          );
        `,
      });
      workspace.addMetadata('AppBehavior', 'BehaviorB', {
        sourceCode: `
          import { createHash } from 'node:crypto';
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior' },
            async function behaviorB() {
              return createHash('md5');
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appGenerator.generate(metadata, workspace.context)) as string;

      // Should only appear once
      const matches = result.match(/import \{ createHash \}/g);
      expect(matches).toHaveLength(1);
    });
  });
});
