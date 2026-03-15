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
        `
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
        `
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
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('id: number');
      expect(result).toContain('id: string');
    });
  });

  describe('static properties', () => {
    it('should include static dataSource property', async () => {
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
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static dataSource: any');
    });

    it('should include static schema property', async () => {
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
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static schema: any');
    });
  });

  describe('base type properties', () => {
    it('should resolve base type properties to native types instead of import paths', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'Email', {
        sourceCode: `
          import { BaseType } from '@apexdesigner/dsl';
          export class Email extends BaseType<string> {}
        `
      });
      workspace.addMetadata('BusinessObject', 'Tutor', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { Email } from '@base-types';
          export class Tutor extends BusinessObject {
            id!: number;
            email?: Email;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('email?: string');
      expect(result).not.toContain('import(');
    });
  });

  describe('test fixtures', () => {
    it('should have a TestFixture trigger', () => {
      const trigger = businessObjectTypeGenerator.triggers.find(t => t.metadataType === 'TestFixture');
      expect(trigger).toBeDefined();
    });

    it('should include static testFixtures property', async () => {
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
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static testFixtures');
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
        `
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
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static claimNext(');
    });
  });

  describe('optional behavior parameters', () => {
    it('should preserve optional marker on behavior parameters', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'UserTask', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class UserTask extends BusinessObject {
            id!: number;
          }
        `
      });
      workspace.addMetadata('Behavior', 'UserTaskClaim', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { UserTask } from '@business-objects';
          addBehavior(
            UserTask,
            { type: 'Instance', httpMethod: 'Post' },
            async function claim(userTask: UserTask, options?: any) {
              return;
            }
          );
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('options?:');
    });
  });

  describe('view-backed business objects', () => {
    it('should only generate read-only method signatures when setView is present', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'LatestProcessDesign', {
        sourceCode: `
          import { BusinessObject, setView } from '@apexdesigner/dsl';
          export class LatestProcessDesign extends BusinessObject {
            id!: number;
            name?: string;
          }
          setView(LatestProcessDesign, \`SELECT * FROM process_design\`);
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectTypeGenerator.generate(metadata, workspace.context)) as string;

      // Should have read methods
      expect(result).toContain('static find(');
      expect(result).toContain('static findOne(');
      expect(result).toContain('static findById(');
      expect(result).toContain('static count(');

      // Should NOT have write methods
      expect(result).not.toContain('static create(');
      expect(result).not.toContain('static createMany(');
      expect(result).not.toContain('static update(');
      expect(result).not.toContain('static updateById(');
      expect(result).not.toContain('static upsert(');
      expect(result).not.toContain('static delete(');
      expect(result).not.toContain('static deleteById(');
      expect(result).not.toContain('static findOrCreate(');
    });
  });
});
