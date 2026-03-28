import { describe, it, expect } from 'vitest';
import { businessObjectFormGroupGenerator } from './business-object-form-group.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectFormGroupGenerator', () => {
  describe('triggers', () => {
    it('should have a Behavior trigger so output regenerates when behaviors change', () => {
      const behaviorTrigger = businessObjectFormGroupGenerator.triggers.find(t => t.metadataType === 'Behavior');
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
      const outputs = businessObjectFormGroupGenerator.outputs(behaviorMeta);

      expect(outputs).toContain('client/src/app/business-objects/process-design-form-group.ts');
    });
  });

  describe('instance behavior delegation', () => {
    it('should generate delegating methods for instance behaviors', async () => {
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
      const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
      const content = result instanceof Map ? result.get('client/src/app/business-objects/process-design-form-group.ts')! : (result as string);

      expect(content).toContain('async enable()');
      expect(content).toContain('new ProcessDesign(this.value)');
      expect(content).toContain('instance.enable()');
    });

    it('should generate static delegating methods for class behaviors', async () => {
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
      const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
      const content = result instanceof Map ? result.get('client/src/app/business-objects/process-design-form-group.ts')! : (result as string);

      expect(content).toContain('static async upload');
      expect(content).toContain('ProcessDesign.upload');
    });

    it('should not generate delegating methods for lifecycle behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `
      });
      workspace.addMetadata('Behavior', 'ProcessDesignBeforeCreate', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addBehavior(
            ProcessDesign,
            { type: 'Before Create' },
            async function beforeCreate(processDesign: ProcessDesign) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
      const content = result instanceof Map ? result.get('client/src/app/business-objects/process-design-form-group.ts')! : (result as string);

      expect(content).not.toContain('beforeCreate');
    });

    it('should generate createItemGroup override in FormArray class', async () => {
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
      const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
      const content = result instanceof Map ? result.get('client/src/app/business-objects/process-design-form-group.ts')! : (result as string);

      expect(content).toContain('protected override createItemGroup()');
      expect(content).toContain('return new ProcessDesignFormGroup()');
    });

    it('should generate an object getter that returns a BO instance', async () => {
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
      const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
      const content = result instanceof Map ? result.get('client/src/app/business-objects/process-design-form-group.ts')! : (result as string);

      expect(content).toContain('get object(): ProcessDesign');
      expect(content).toContain('return new ProcessDesign(this.getRawValue())');
    });

    it('should generate an array getter on FormArray that returns BO instances', async () => {
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
      const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
      const content = result instanceof Map ? result.get('client/src/app/business-objects/process-design-form-group.ts')! : (result as string);

      expect(content).toContain('get array(): ProcessDesign[]');
      expect(content).toContain('this.controls.map((group: ProcessDesignFormGroup) => group.object)');
    });

    it('should pass parameters through to the delegated method', async () => {
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
      const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
      const content = result instanceof Map ? result.get('client/src/app/business-objects/process-design-form-group.ts')! : (result as string);

      expect(content).toContain('async assign(userId: string, role?: string)');
      expect(content).toContain('instance.assign(userId, role)');
    });

    it('should resolve Header<T> to inner type T in behavior method signatures', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'TestItem', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class TestItem extends BusinessObject {
            id!: number;
          }
        `
      });
      workspace.addMetadata('Behavior', 'TestItemExport', {
        sourceCode: `
          import { addBehavior, Header } from '@apexdesigner/dsl';
          import { TestItem } from '@business-objects';
          addBehavior(
            TestItem,
            { type: 'Instance', httpMethod: 'Get' },
            async function exportItem(testItem: TestItem, accept: Header<string>) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
      const content = result instanceof Map ? result.get('client/src/app/business-objects/test-item-form-group.ts')! : (result as string);

      // Should use inner type 'string', not 'Header<string>'
      expect(content).toContain('accept: string');
      expect(content).not.toContain('Header<string>');
    });
  });

  it('should generate entityName on PersistedArray subclass', async () => {
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
    const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
    const content = result instanceof Map ? result.get('client/src/app/business-objects/process-design-form-group.ts')! : (result as string);

    // PersistedArray subclass should have entityName
    const paSection = content.split('class ProcessDesignPersistedArray')[1];
    expect(paSection).toContain("readonly entityName = 'ProcessDesign' as const");
  });

  it('should generate entityName on FormArray subclass', async () => {
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
    const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
    const content = result instanceof Map ? result.get('client/src/app/business-objects/process-design-form-group.ts')! : (result as string);

    // FormArray subclass should have entityName
    const faSection = content.split('class ProcessDesignFormArray')[1];
    expect(faSection).toContain("readonly entityName = 'ProcessDesign' as const");
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
        `
      });
      workspace.addMetadata('InterfaceDefinition', 'TestSummary', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class TestSummary extends InterfaceDefinition {
            name?: string;
          }
        `
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
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
      const content = result instanceof Map ? result.get('client/src/app/business-objects/test-item-form-group.ts')! : (result as string);

      expect(content).toContain('getSummaries');
      expect(content).toContain("import type { TestSummary } from '../interface-definitions/index'");
    });

    it('should import unrelated business objects referenced in behavior return types', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `
      });
      workspace.addMetadata('BusinessObject', 'AuditEntry', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class AuditEntry extends BusinessObject {
            id!: number;
          }
        `
      });
      workspace.addMetadata('Behavior', 'OrderGetAuditLog', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { Order } from '@business-objects';
          import { AuditEntry } from '@business-objects';
          addBehavior(
            Order,
            { type: 'Instance', httpMethod: 'Get' },
            async function getAuditLog(order: Order): Promise<AuditEntry[]> {
              return [];
            }
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'Order')!;
      const result = await businessObjectFormGroupGenerator.generate(metadata, workspace.context);
      const content = result instanceof Map ? result.get('client/src/app/business-objects/order-form-group.ts')! : (result as string);

      expect(content).toContain('getAuditLog');
      expect(content).toContain("import type { AuditEntry } from './audit-entry'");
    });
  });
});
