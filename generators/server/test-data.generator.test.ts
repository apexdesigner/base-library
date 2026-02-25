import { describe, it, expect } from 'vitest';
import { testDataGenerator } from './test-data.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('testDataGenerator', () => {
  it('should output to server/src/create-test-data.ts', () => {
    const outputs = testDataGenerator.outputs({ name: 'Order' } as any);
    expect(outputs).toEqual(['server/src/create-test-data.ts']);
  });

  it('should extract setTestData defaults and generate create-test-data.ts', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'ProcessDesign', {
      sourceCode: `
        import { BusinessObject, setTestData } from '@apexdesigner/dsl';
        export class ProcessDesign extends BusinessObject {
          id!: string;
        }
        setTestData(ProcessDesign, {
          name: "Test Process",
          version: 1,
          suspended: false,
        });
      `,
    });
    workspace.addMetadata('BusinessObject', 'Token', {
      sourceCode: `
        import { BusinessObject, setTestData } from '@apexdesigner/dsl';
        export class Token extends BusinessObject {
          id!: string;
        }
        setTestData(Token, {
          activityId: "activity-1",
          status: "Active",
        });
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await testDataGenerator.generate(metadata, workspace.context)) as string;

    // Should import both BOs
    expect(result).toContain('import { ProcessDesign } from "./business-objects/process-design.js"');
    expect(result).toContain('import { Token } from "./business-objects/token.js"');

    // Should have defaults map
    expect(result).toContain('const defaults: Record<string, Record<string, any>> = {');
    expect(result).toContain('ProcessDesign: {');
    expect(result).toContain('Token: {');

    // Should export createTestData function
    expect(result).toContain('export async function createTestData(');
    expect(result).toContain('return model.create(data)');
  });

  it('should skip BOs without setTestData', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'ProcessDesign', {
      sourceCode: `
        import { BusinessObject, setTestData } from '@apexdesigner/dsl';
        export class ProcessDesign extends BusinessObject {
          id!: string;
        }
        setTestData(ProcessDesign, { name: "Test" });
      `,
    });
    workspace.addMetadata('BusinessObject', 'Token', {
      sourceCode: `
        import { BusinessObject } from '@apexdesigner/dsl';
        export class Token extends BusinessObject {
          id!: string;
        }
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await testDataGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('ProcessDesign');
    expect(result).not.toContain('Token');
  });

  it('should return empty string when no BOs have setTestData', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'Token', {
      sourceCode: `
        import { BusinessObject } from '@apexdesigner/dsl';
        export class Token extends BusinessObject {
          id!: string;
        }
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await testDataGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toBe('');
  });
});
