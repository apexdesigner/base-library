import { describe, it, expect } from 'vitest';
import { businessObjectTestGenerator } from './business-object-test.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectTestGenerator', () => {
  it('should output to server/src/business-objects/<bo>.test.ts', () => {
    const outputs = businessObjectTestGenerator.outputs({ name: 'ProcessDesign', sourceFile: { getStatements: () => [] } } as any);
    expect(outputs).toEqual(['server/src/business-objects/process-design.test.ts']);
  });

  it('should generate test file with describe/it blocks from addTest calls', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'ProcessDesign', {
      sourceCode: `
        import { BusinessObject } from '@apexdesigner/dsl';
        export class ProcessDesign extends BusinessObject {
          id!: string;
        }
      `,
    });
    workspace.addMetadata('Behavior', 'ProcessDesignDisable', {
      sourceCode: `
        import { addBehavior, addTest } from '@apexdesigner/dsl';
        import { ProcessDesign } from '@business-objects';
        import { expect } from 'vitest';
        addBehavior(
          ProcessDesign,
          { type: 'Instance', httpMethod: 'Post' },
          async function disable(processDesign: ProcessDesign) {
            return;
          }
        );
        addTest("should set suspended to true", async () => {
          const design = await ProcessDesign.testFixtures.simple();
          expect(design).toBeDefined();
        });
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await businessObjectTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('import { describe, it, expect, afterEach } from "vitest"');
    expect(result).toContain('import { ProcessDesign } from "./process-design.js"');
    expect(result).toContain('describe("ProcessDesign", () => {');
    expect(result).toContain('afterEach(() => ProcessDesign.dataSource.truncateAll())');
    expect(result).toContain('describe("disable", () => {');
    expect(result).toContain('it("should set suspended to true", async () => {');
  });

  it('should skip behaviors without addTest calls', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'ProcessDesign', {
      sourceCode: `
        import { BusinessObject } from '@apexdesigner/dsl';
        export class ProcessDesign extends BusinessObject {
          id!: string;
        }
      `,
    });
    workspace.addMetadata('Behavior', 'ProcessDesignUpload', {
      sourceCode: `
        import { addBehavior } from '@apexdesigner/dsl';
        import { ProcessDesign } from '@business-objects';
        addBehavior(
          ProcessDesign,
          { type: 'Class', httpMethod: 'Post' },
          async function upload(options: any) {
            return;
          }
        );
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = await businessObjectTestGenerator.generate(metadata, workspace.context);

    expect(result).toContain('it.skip("no tests defined")');
  });

  it('should include debug setup when test body references debug', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'ProcessDesign', {
      sourceCode: `
        import { BusinessObject } from '@apexdesigner/dsl';
        export class ProcessDesign extends BusinessObject {
          id!: string;
        }
      `,
    });
    workspace.addMetadata('Behavior', 'ProcessDesignDisable', {
      sourceCode: `
        import createDebug from 'debug';
        import { addBehavior, addTest } from '@apexdesigner/dsl';
        import { ProcessDesign } from '@business-objects';
        import { expect } from 'vitest';
        const debug = createDebug('Test');
        addBehavior(
          ProcessDesign,
          { type: 'Instance' },
          async function disable(pd: ProcessDesign) { return; }
        );
        addTest("should work", async () => {
          const d = await ProcessDesign.testFixtures.simple();
          debug("d.id %j", d.id);
          expect(d).toBeDefined();
        });
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await businessObjectTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('import createDebug from "debug"');
    expect(result).toContain('const debug = createDebug(');
  });

  it('should resolve @app imports to ../app.js', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'ProcessDesign', {
      sourceCode: `
        import { BusinessObject } from '@apexdesigner/dsl';
        export class ProcessDesign extends BusinessObject {
          id!: string;
        }
      `,
    });
    workspace.addMetadata('Behavior', 'ProcessDesignUpload', {
      sourceCode: `
        import { addBehavior, addTest } from '@apexdesigner/dsl';
        import { ProcessDesign } from '@business-objects';
        import { App } from '@app';
        import { expect } from 'vitest';
        addBehavior(
          ProcessDesign,
          { type: 'Class', httpMethod: 'Post' },
          async function upload(options: any) { return; }
        );
        addTest("should use App", async () => {
          expect(App).toBeDefined();
        });
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await businessObjectTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('import { App } from "../app.js"');
  });

  it('should collect tests from multiple behaviors into one file', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'ProcessDesign', {
      sourceCode: `
        import { BusinessObject } from '@apexdesigner/dsl';
        export class ProcessDesign extends BusinessObject {
          id!: string;
        }
      `,
    });
    workspace.addMetadata('Behavior', 'ProcessDesignDisable', {
      sourceCode: `
        import { addBehavior, addTest } from '@apexdesigner/dsl';
        import { ProcessDesign } from '@business-objects';
        import { expect } from 'vitest';
        addBehavior(
          ProcessDesign,
          { type: 'Instance' },
          async function disable(pd: ProcessDesign) { return; }
        );
        addTest("test disable", async () => {
          expect(true).toBe(true);
        });
      `,
    });
    workspace.addMetadata('Behavior', 'ProcessDesignEnable', {
      sourceCode: `
        import { addBehavior, addTest } from '@apexdesigner/dsl';
        import { ProcessDesign } from '@business-objects';
        import { expect } from 'vitest';
        addBehavior(
          ProcessDesign,
          { type: 'Instance' },
          async function enable(pd: ProcessDesign) { return; }
        );
        addTest("test enable", async () => {
          expect(true).toBe(true);
        });
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await businessObjectTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('describe("disable", () => {');
    expect(result).toContain('describe("enable", () => {');
    expect(result).toContain('it("test disable"');
    expect(result).toContain('it("test enable"');
  });
});
