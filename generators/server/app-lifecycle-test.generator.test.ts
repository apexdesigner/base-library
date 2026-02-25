import { describe, it, expect } from 'vitest';
import { appLifecycleTestGenerator } from './app-lifecycle-test.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('appLifecycleTestGenerator', () => {
  it('should output to server/src/app-behaviors/<name>.test.ts', () => {
    const outputs = appLifecycleTestGenerator.outputs({ name: 'LoadSampleDesigns' } as any);
    expect(outputs).toEqual(['server/src/app-behaviors/load-sample-designs.test.ts']);
  });

  it('should generate lifecycle test file with describe/it blocks', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'LoadSampleDesigns', {
      sourceCode: `
        import { addAppBehavior, addTest } from '@apexdesigner/dsl';
        import { ProcessDesign } from '@business-objects';
        import { expect } from 'vitest';
        addAppBehavior(
          { lifecycleStage: 'After Start' },
          async function loadSampleDesigns() {
            return;
          }
        );
        addTest("should load designs when none exist", async () => {
          const designs = await ProcessDesign.find();
          expect(designs).toHaveLength(0);
        });
      `,
    });

    const metadata = workspace.context.listMetadata('AppBehavior')[0];
    const result = (await appLifecycleTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('import { describe, it, expect, afterEach } from "vitest"');
    expect(result).toContain('import { loadSampleDesigns } from "./load-sample-designs.js"');
    expect(result).toContain('import { ProcessDesign } from "../business-objects/process-design.js"');
    expect(result).toContain('describe("loadSampleDesigns", () => {');
    expect(result).toContain('afterEach(() => ProcessDesign.dataSource.truncateAll())');
    expect(result).toContain('it("should load designs when none exist"');
  });

  it('should skip non-lifecycle app behaviors', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'ComputeSha1', {
      sourceCode: `
        import { addAppBehavior, addTest } from '@apexdesigner/dsl';
        import { expect } from 'vitest';
        addAppBehavior(
          { type: 'Class Behavior' },
          async function computeSha1(data: unknown): Promise<string> {
            return 'abc';
          }
        );
        addTest("test", async () => {
          expect(true).toBe(true);
        });
      `,
    });

    // Trigger condition should reject non-lifecycle
    const metadata = workspace.context.listMetadata('AppBehavior')[0];
    const trigger = appLifecycleTestGenerator.triggers[0];
    expect(trigger.condition!(metadata, {} as any)).toBe(false);
  });

  it('should return empty Map when no addTest calls', async () => {
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

    const metadata = workspace.context.listMetadata('AppBehavior')[0];
    const result = await appLifecycleTestGenerator.generate(metadata, workspace.context);

    expect(result).toContain('it.skip("no tests defined")');
  });

});
