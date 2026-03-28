import { describe, it, expect } from 'vitest';
import { businessObjectFormGroupTypeGenerator } from './business-object-form-group-type.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectFormGroupTypeGenerator', () => {
  describe('triggers', () => {
    it('should have a Behavior trigger so output regenerates when behaviors change', () => {
      const behaviorTrigger = businessObjectFormGroupTypeGenerator.triggers.find(t => t.metadataType === 'Behavior');
      expect(behaviorTrigger).toBeDefined();
    });
  });

  describe('outputs', () => {
    it('should resolve behavior metadata to parent BO output paths', () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {}
        `
      });
      workspace.addMetadata('Behavior', 'ProcessDesignEnable', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addBehavior(
            ProcessDesign,
            { type: 'Instance', httpMethod: 'Post' },
            async function enable(processDesign: ProcessDesign) {}
          );
        `
      });

      const behaviorMeta = workspace.context.listMetadata('Behavior')[0];
      const outputs = businessObjectFormGroupTypeGenerator.outputs(behaviorMeta);

      expect(outputs).toContain('design/@types/business-objects-client/process-design-form-group.d.ts');
    });
  });

  describe('instance behavior type declarations', () => {
    it('should include instance behavior method declarations', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `
      });
      workspace.addMetadata('Behavior', 'ProcessDesignEnable', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addBehavior(
            ProcessDesign,
            { type: 'Instance', httpMethod: 'Post' },
            async function enable(processDesign: ProcessDesign) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = await businessObjectFormGroupTypeGenerator.generate(metadata, workspace.context);
      const content =
        result instanceof Map ? result.get('design/@types/business-objects-client/process-design-form-group.d.ts')! : (result as string);

      expect(content).toContain('enable(): Promise<any>');
    });

    it('should include static class behavior method declarations', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `
      });
      workspace.addMetadata('Behavior', 'ProcessDesignUpload', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addBehavior(
            ProcessDesign,
            { type: 'Class', httpMethod: 'Post' },
            async function upload(options: any) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = await businessObjectFormGroupTypeGenerator.generate(metadata, workspace.context);
      const content =
        result instanceof Map ? result.get('design/@types/business-objects-client/process-design-form-group.d.ts')! : (result as string);

      expect(content).toContain('static upload');
    });

    it('should include parameters in behavior method declarations', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `
      });
      workspace.addMetadata('Behavior', 'ProcessDesignAssign', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addBehavior(
            ProcessDesign,
            { type: 'Instance', httpMethod: 'Put' },
            async function assign(processDesign: ProcessDesign, userId: string, role?: string) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = await businessObjectFormGroupTypeGenerator.generate(metadata, workspace.context);
      const content =
        result instanceof Map ? result.get('design/@types/business-objects-client/process-design-form-group.d.ts')! : (result as string);

      expect(content).toContain('assign(userId: string, role?: string): Promise<any>');
    });

    it('should declare constructor with data as first positional arg and options as second', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = await businessObjectFormGroupTypeGenerator.generate(metadata, workspace.context);
      const content =
        result instanceof Map ? result.get('design/@types/business-objects-client/process-design-form-group.d.ts')! : (result as string);

      expect(content).toContain('constructor(data?: Record<string, any> | null, options?: PersistedFormGroupOptions)');
    });

    it('should include object getter in type declaration', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = await businessObjectFormGroupTypeGenerator.generate(metadata, workspace.context);
      const content =
        result instanceof Map ? result.get('design/@types/business-objects-client/process-design-form-group.d.ts')! : (result as string);

      expect(content).toContain('get object(): ProcessDesign');
    });

    it('should include array getter in FormArray type declaration', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = await businessObjectFormGroupTypeGenerator.generate(metadata, workspace.context);
      const content =
        result instanceof Map ? result.get('design/@types/business-objects-client/process-design-form-array.d.ts')! : (result as string);

      expect(content).toContain('get array(): ProcessDesign[]');
    });
  });

  it('should include entityName in PersistedArray type declaration', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'ProcessDesign', {
      sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = await businessObjectFormGroupTypeGenerator.generate(metadata, workspace.context);
    const content =
      result instanceof Map ? result.get('design/@types/business-objects-client/process-design-persisted-array.d.ts')! : (result as string);

    expect(content).toContain("readonly entityName: 'ProcessDesign'");
  });

  it('should include entityName in FormArray type declaration', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'ProcessDesign', {
      sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = await businessObjectFormGroupTypeGenerator.generate(metadata, workspace.context);
    const content = result instanceof Map ? result.get('design/@types/business-objects-client/process-design-form-array.d.ts')! : (result as string);

    expect(content).toContain("readonly entityName: 'ProcessDesign'");
  });

  describe('behavior type imports', () => {
    it('should import interface definitions referenced in behavior return types', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'TestItem', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class TestItem extends BusinessObject {
            id!: number;
          }
        `,
      });
      workspace.addMetadata('InterfaceDefinition', 'TestSummary', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class TestSummary extends InterfaceDefinition {
            name?: string;
          }
        `,
      });
      workspace.addMetadata('Behavior', 'TestItemGetSummaries', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { TestItem } from '@business-objects';
          import { TestSummary } from '@interface-definitions';
          addBehavior(
            TestItem,
            { type: 'Class', httpMethod: 'Get' },
            async function getSummaries(): Promise<TestSummary[]> {
              return [];
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = await businessObjectFormGroupTypeGenerator.generate(metadata, workspace.context);
      const content =
        result instanceof Map ? result.get('design/@types/business-objects-client/test-item-form-group.d.ts')! : (result as string);

      expect(content).toContain('getSummaries');
      expect(content).toContain("import type { TestSummary } from '../interface-definitions/index'");
    });
  });
});
