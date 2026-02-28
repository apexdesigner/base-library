import { describe, it, expect } from 'vitest';
import { boAfterStartGenerator } from './bo-after-start.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('boAfterStartGenerator', () => {
  describe('basic structure', () => {
    it('should output to server/src/business-objects/{bo}.{func}.ts', () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Behavior', 'TestItemStartup', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { TestItem } from '@business-objects';
          addBehavior(
            TestItem,
            { type: 'After Start' },
            async function startup() {}
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Behavior')[0];
      const outputs = boAfterStartGenerator.outputs(metadata);

      expect(outputs).toEqual(['server/src/business-objects/test-item.startup.ts']);
    });

    it('should generate exported async function with debug', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Behavior', 'TestItemStartup', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { TestItem } from '@business-objects';
          addBehavior(
            TestItem,
            { type: 'After Start' },
            async function startup() {
              const items = await TestItem.find();
              console.log('Found', items.length, 'items');
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Behavior')[0];
      const result = (await boAfterStartGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import createDebug from "debug"');
      expect(result).toContain('const Debug = createDebug(');
      expect(result).toContain('export async function startup()');
      expect(result).toContain('const debug = Debug.extend("startup")');
      expect(result).toContain("const items = await TestItem.find()");
    });

    it('should skip non-After Start behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Behavior', 'TestItemProcess', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { TestItem } from '@business-objects';
          addBehavior(
            TestItem,
            { type: 'Class', httpMethod: 'Post' },
            async function process() { return 'done'; }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Behavior')[0];
      const result = (await boAfterStartGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toBe('');
    });
  });

  describe('imports', () => {
    it('should map @business-objects to co-located ./ paths', async () => {
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
        `,
      });

      const metadata = workspace.context.listMetadata('Behavior')[0];
      const result = (await boAfterStartGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { TestItem } from "./test-item.js"');
    });

    it('should pass through external package imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Behavior', 'TestItemStartup', {
        sourceCode: `
          import fs from 'node:fs';
          import { addBehavior } from '@apexdesigner/dsl';
          import { TestItem } from '@business-objects';
          addBehavior(
            TestItem,
            { type: 'After Start' },
            async function startup() {
              fs.existsSync('.');
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Behavior')[0];
      const result = (await boAfterStartGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import fs from "node:fs"');
    });

    it('should map @project to ../app.js', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Behavior', 'TestItemStartup', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { TestItem } from '@business-objects';
          import { App } from '@project';
          addBehavior(
            TestItem,
            { type: 'After Start' },
            async function startup() {
              await App.someMethod();
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Behavior')[0];
      const result = (await boAfterStartGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { App } from "../app.js"');
    });

    it('should skip @apexdesigner/dsl and vitest imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Behavior', 'TestItemStartup', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { expect } from 'vitest';
          import { TestItem } from '@business-objects';
          addBehavior(
            TestItem,
            { type: 'After Start' },
            async function startup() {}
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Behavior')[0];
      const result = (await boAfterStartGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('@apexdesigner/dsl');
      expect(result).not.toContain('vitest');
    });
  });
});
