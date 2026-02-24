import { describe, it, expect } from 'vitest';
import { businessObjectGenerator } from './business-object.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectGenerator', () => {
  describe('triggers', () => {
    it('should have a Behavior trigger so output regenerates when behaviors change', () => {
      const behaviorTrigger = businessObjectGenerator.triggers.find(t => t.metadataType === 'Behavior');
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
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

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
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

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
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static async deleteById(id: number)');
    });

    it('should use string for Uuid id in updateById', async () => {
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
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static async updateById(\n    id: string,');
    });

    it('should use string for base type id (not inline import path)', async () => {
      const workspace = createSimpleMockWorkspace({
        projectSourceCode: `
          import { Project } from '@apexdesigner/dsl';
          export class MyProject extends Project {
            defaultDataSource = Postgres;
          }
        `,
      });
      workspace.addMetadata('DataSource', 'Postgres', {
        sourceCode: `
          import { DataSource } from '@apexdesigner/dsl';
          import { Uuid } from '@base-types';
          export class Postgres extends DataSource {
            configuration = { persistenceType: 'Postgres' };
            defaultIdType = Uuid;
          }
        `,
      });
      workspace.addMetadata('BaseType', 'Uuid', {
        sourceCode: `
          import { BaseType, setColumnDefaults } from '@apexdesigner/dsl';
          export class Uuid extends BaseType<string> {}
          setColumnDefaults(Uuid, 'uuid');
        `,
      });
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { Uuid } from '@base-types';
          export class ProcessDesign extends BusinessObject {
            id!: Uuid;
          }
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('id: string,');
      expect(result).not.toContain('import(');
    });
  });

  describe('behavior imports', () => {
    it('should import App when a behavior uses @project', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `,
      });
      workspace.addMetadata('Behavior', 'ProcessDesignUpload', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          import { App } from '@project';
          addBehavior(
            ProcessDesign,
            { type: 'Class', httpMethod: 'Post' },
            async function upload(options: any) {
              const result = await App.validateProcessDesign(options);
              return result;
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { App } from "../app.js"');
    });

    it('should import other business objects referenced by behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `,
      });
      workspace.addMetadata('BusinessObject', 'ProcessDesignHistory', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesignHistory extends BusinessObject {
            id!: string;
          }
        `,
      });
      workspace.addMetadata('Behavior', 'ProcessDesignUpload', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign, ProcessDesignHistory } from '@business-objects';
          addBehavior(
            ProcessDesign,
            { type: 'Class', httpMethod: 'Post' },
            async function upload(options: any) {
              await ProcessDesignHistory.create({ processDesignId: 1 });
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'ProcessDesign')!;
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { ProcessDesignHistory } from "./process-design-history.js"');
      // Should not import self
      expect(result).not.toMatch(/import.*ProcessDesign.*from "\.\/process-design\.js"/);
    });
  });

  describe('behavior debug scoping', () => {
    it('should inject scoped debug into BO instance behavior methods', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {}
        `,
      });
      workspace.addMetadata('Behavior', 'ProcessDesignDisable', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addBehavior(
            ProcessDesign,
            { type: 'Instance', httpMethod: 'Put' },
            async function disable(processDesign: ProcessDesign) {
              debug("processDesign.id %j", processDesign.id);
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('const debug = Debug.extend("disable")');
    });

    it('should inject scoped debug into BO class behavior methods', async () => {
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
            async function claimNext() {
              debug("claiming next task");
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('const debug = Debug.extend("claimNext")');
    });

    it('should inject scoped debug into behavior methods from a mixin', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Mixin', 'Claimable', {
        sourceCode: `
          import { Mixin } from '@apexdesigner/dsl';
          export class Claimable extends Mixin {}
        `,
      });
      workspace.addMetadata('BusinessObject', 'ServiceTask', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { Claimable } from '@mixins';
          export class ServiceTask extends BusinessObject {
            static mixins = [Claimable];
          }
        `,
      });
      workspace.addMetadata('Behavior', 'ServiceTaskClaim', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { ServiceTask } from '@business-objects';
          addBehavior(
            ServiceTask,
            { type: 'Instance', httpMethod: 'Put' },
            async function claim(serviceTask: ServiceTask) {
              debug("claiming instance");
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('const debug = Debug.extend("claim")');
    });
  });
});
