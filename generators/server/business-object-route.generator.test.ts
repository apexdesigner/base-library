import { describe, it, expect } from 'vitest';
import { businessObjectRouteGenerator } from './business-object-route.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectRouteGenerator', () => {
  describe('triggers', () => {
    it('should have a Behavior trigger so output regenerates when behaviors change', () => {
      const behaviorTrigger = businessObjectRouteGenerator.triggers.find(t => t.metadataType === 'Behavior');
      expect(behaviorTrigger).toBeDefined();
    });
  });

  describe('outputs', () => {
    it('should resolve behavior metadata to parent BO route file', () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {}
        `,
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
        `,
      });

      const behaviorMeta = workspace.context.listMetadata('Behavior')[0];
      const outputs = businessObjectRouteGenerator.outputs(behaviorMeta);

      expect(outputs).toEqual(['server/src/routes/process-designs.ts']);
    });
  });

  describe('id coercion from req.params.id', () => {
    it('should use Number() to parse id for number id BO', async () => {
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
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('String(req.params.id)');
      expect(result).toContain('Number(req.params.id)');
    });

    it('should use req.params.id directly for string id BO', async () => {
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
      const result = (await businessObjectRouteGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('Number(req.params.id)');
      expect(result).toContain('req.params.id');
    });
  });
});
