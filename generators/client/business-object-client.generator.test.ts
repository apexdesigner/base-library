import { describe, it, expect } from 'vitest';
import { businessObjectClientGenerator } from './business-object-client.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectClientGenerator', () => {
  describe('id type in method signatures', () => {
    it('should use number for number id in findById', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `,
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
        `,
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
        `,
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
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectClientGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static async findById(\n    id: string,');
    });
  });
});
