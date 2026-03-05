import { describe, it, expect } from 'vitest';
import { businessObjectClientTypeGenerator } from './business-object-client-type.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectClientTypeGenerator', () => {
  describe('triggers', () => {
    it('should have a Behavior trigger so output regenerates when behaviors change', () => {
      const behaviorTrigger = businessObjectClientTypeGenerator.triggers.find(t => t.metadataType === 'Behavior');
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
      const result = (await businessObjectClientTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static findById(id: number,');
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
      const result = (await businessObjectClientTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static updateById(id: number,');
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
      const result = (await businessObjectClientTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static deleteById(id: number)');
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
      const result = (await businessObjectClientTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static findById(id: string,');
    });
  });

  describe('CRUD methods', () => {
    it('should include all CRUD methods with typed filters', async () => {
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
      const result = (await businessObjectClientTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static create(data: Partial<Order>): Promise<Order>;');
      expect(result).toContain('static createMany(data: Partial<Order>[]): Promise<Order[]>;');
      expect(result).toContain('static find(filter?: FindFilter<Order>): Promise<Order[]>;');
      expect(result).toContain('static findOne(filter: FindOneFilter<Order>): Promise<Order | null>;');
      expect(result).toContain('static findOrCreate(');
      expect(result).toContain('static count(');
      expect(result).toContain('static update(filter: UpdateFilter<Order>,');
      expect(result).toContain('static upsert(');
      expect(result).toContain('static delete(filter: DeleteFilter<Order>): Promise<number>;');
    });

    it('should import filter types from schema-persistence', async () => {
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
      const result = (await businessObjectClientTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain("import type { FindFilter, FindOneFilter, UpdateFilter, DeleteFilter } from '@apexdesigner/schema-persistence';");
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
      const result = (await businessObjectClientTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('readonly email?: string;');
      expect(result).not.toContain('readonly email?: Email;');
    });
  });
});
