import { describe, it, expect } from 'vitest';
import { businessObjectClientGenerator } from './business-object-client.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectClientGenerator', () => {
  describe('triggers', () => {
    it('should have a Behavior trigger so output regenerates when behaviors change', () => {
      const behaviorTrigger = businessObjectClientGenerator.triggers.find(t => t.metadataType === 'Behavior');
      expect(behaviorTrigger).toBeDefined();
    });
  });

  describe('id type in method signatures', () => {
    it('should use number for number id in findById', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectClientGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static async findById(\n    id: number,');
    });

    it('should use number for number id in updateById', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectClientGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static async updateById(\n    id: number,');
    });

    it('should use number for number id in deleteById', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectClientGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static async deleteById(id: number)');
    });

    it('should use string for Uuid id in findById', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          type Uuid = string;
          export class ProcessDesign extends BusinessObject {
            id!: Uuid;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectClientGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static async findById(\n    id: string,');
    });
  });

  describe('behavior method body', () => {
    it('should pass single parameter directly without wrapping in object', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessInstance', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessInstance extends BusinessObject {
            id!: string;
          }
        `
      });
      workspace.addMetadata('Behavior', 'ProcessInstanceStart', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessInstance } from '@business-objects';
          addBehavior(
            ProcessInstance,
            { type: 'Class', httpMethod: 'Post' },
            async function start(options: { designId: string; variables?: Record<string, unknown> }) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectClientGenerator.generate(metadata, workspace.context)) as string;

      // Should pass options directly, not { options }
      expect(result).toContain('return this.post<any>(url, options)');
      expect(result).not.toContain('{ options }');
    });

    it('should pass instance behavior single parameter directly', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessInstance', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessInstance extends BusinessObject {
            id!: string;
          }
        `
      });
      workspace.addMetadata('Behavior', 'ProcessInstanceSignal', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessInstance } from '@business-objects';
          addBehavior(
            ProcessInstance,
            { type: 'Instance', httpMethod: 'Post' },
            async function signal(instance: ProcessInstance, data: { name: string }) {}
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectClientGenerator.generate(metadata, workspace.context)) as string;

      // Should pass data directly, not { data }
      expect(result).toContain('return BusinessObjectBase.post<any>(url, data)');
      expect(result).not.toContain('{ data }');
    });
  });

  describe('findOne method', () => {
    it('should generate a findOne static method that returns a single instance or null', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectClientGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static async findOne(filter?: any): Promise<Order | null>');
      expect(result).toContain("params['filter'] = JSON.stringify(filter)");
      expect(result).toContain('find-one');
      expect(result).toContain('return data ? new Order(data) : null');
    });
  });

  describe('base type resolution in data interface', () => {
    it('should be implemented', () => {
      // TODO: Add test implementation
    });

    it('should resolve base type to native type in scalar properties', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'Email', {
        sourceCode: `
          import { BaseType } from '@apexdesigner/dsl';
          export class Email extends BaseType<string> {}
        `
      });
      workspace.addMetadata('BusinessObject', 'ProcessAdmin', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { Email } from '@base-types';
          export class ProcessAdmin extends BusinessObject {
            id!: number;
            email?: Email;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectClientGenerator.generate(metadata, workspace.context)) as string;

      // Should emit 'string' not 'Email' since Email extends BaseType<string>
      expect(result).toContain('readonly email?: string;');
      expect(result).not.toContain('readonly email?: Email;');
    });
  });
});
