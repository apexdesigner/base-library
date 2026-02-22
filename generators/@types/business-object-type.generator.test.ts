import { describe, it, expect } from 'vitest';
import { businessObjectTypeGenerator } from './business-object-type.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectTypeGenerator', () => {
  describe('id type', () => {
    it('should use number for plain number id', async () => {
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
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('id: number');
    });

    it('should use string for string id', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: string;
          }
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('id: string');
    });

    it('should use string for Uuid id', async () => {
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
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('id: number');
      expect(result).toContain('id: string');
    });
  });
});
