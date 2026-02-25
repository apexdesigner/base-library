import { describe, it, expect } from 'vitest';
import { appTestGenerator } from './app-test.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('appTestGenerator', () => {
  it('should output to server/src/app.test.ts', () => {
    const outputs = appTestGenerator.outputs({ name: 'SomeBehavior' } as any);
    expect(outputs).toEqual(['server/src/app.test.ts']);
  });

  it('should generate App test file from non-lifecycle app behaviors', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'EvaluateCondition', {
      sourceCode: `
        import { addAppBehavior, addTest } from '@apexdesigner/dsl';
        import { expect } from 'vitest';
        addAppBehavior(
          { type: 'Class Behavior' },
          async function evaluateCondition(expr: string | undefined, context: any): Promise<boolean> {
            return true;
          }
        );
        addTest("should return true for undefined expression", async () => {
          const result = await App.evaluateCondition(undefined, { data: {} });
          expect(result).toBe(true);
        });
      `,
    });

    const metadata = workspace.context.listMetadata('AppBehavior')[0];
    const result = (await appTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('import { describe, it, expect, afterEach } from "vitest"');
    expect(result).toContain('import { App } from "./app.js"');
    expect(result).toContain('describe("App", () => {');
    expect(result).toContain('describe("evaluateCondition", () => {');
    expect(result).toContain('it("should return true for undefined expression"');
  });

  it('should skip lifecycle app behaviors', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'AfterStart', {
      sourceCode: `
        import { addAppBehavior, addTest } from '@apexdesigner/dsl';
        import { expect } from 'vitest';
        addAppBehavior(
          { lifecycleStage: 'After Start' },
          async function loadDesigns() {
            return;
          }
        );
        addTest("should load", async () => {
          expect(true).toBe(true);
        });
      `,
    });

    const metadata = workspace.context.listMetadata('AppBehavior')[0];
    const result = (await appTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toBe('');
  });

  it('should truncate all App dataSources in afterEach', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'SomeBehavior', {
      sourceCode: `
        import { addAppBehavior, addTest } from '@apexdesigner/dsl';
        import { ProcessDesign } from '@business-objects';
        import { expect } from 'vitest';
        addAppBehavior(
          { type: 'Class Behavior' },
          async function someBehavior() { return; }
        );
        addTest("should work", async () => {
          const d = await ProcessDesign.testFixtures.simple();
          expect(d).toBeDefined();
        });
      `,
    });

    const metadata = workspace.context.listMetadata('AppBehavior')[0];
    const result = (await appTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('import { ProcessDesign } from "./business-objects/process-design.js"');
    expect(result).toContain('for (const ds of Object.values(App.dataSources))');
    expect(result).toContain('await ds.truncateAll()');
  });
});
