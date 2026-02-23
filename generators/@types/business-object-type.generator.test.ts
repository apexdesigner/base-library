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

  describe('triggers', () => {
    it('should have a Behavior trigger so type regenerates when behaviors change', () => {
      const behaviorTrigger = businessObjectTypeGenerator.triggers.find(t => t.metadataType === 'Behavior');
      expect(behaviorTrigger).toBeDefined();
    });
  });

  describe('behaviors', () => {
    it('should include Class behavior as a static method', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ServiceTask', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ServiceTask extends BusinessObject {}
        `,
      });
      workspace.addMetadata('Behavior', 'ServiceTaskClaimNext', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ServiceTask } from '@business-objects';
          addBehavior(
            ServiceTask,
            { type: 'Class', httpMethod: 'Post' },
            async function claimNext(options: any): Promise<ServiceTask | null> {}
          );
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static claimNext(');
    });
  });
});
