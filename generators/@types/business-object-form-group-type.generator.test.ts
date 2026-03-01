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

    it('should not include class behavior method declarations', async () => {
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

      expect(content).not.toContain('upload');
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
});
