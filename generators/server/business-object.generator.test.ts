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
          import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';
          export class Uuid extends BaseType<string> {}
          setPropertyDefaults(Uuid, { column: 'uuid' });
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

  describe('outputs', () => {
    it('should resolve behavior metadata to parent BO file', () => {
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
      const outputs = businessObjectGenerator.outputs(behaviorMeta);

      expect(outputs).toEqual(['server/src/business-objects/process-design.ts']);
    });
  });

  describe('behavior imports', () => {
    it('should import App when a behavior uses @app', async () => {
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
          import { App } from '@app';
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

  describe('test fixtures', () => {
    it('should have a TestFixture trigger', () => {
      const trigger = businessObjectGenerator.triggers.find(t => t.metadataType === 'TestFixture');
      expect(trigger).toBeDefined();
    });

    it('should inline test fixtures as static testFixtures property', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `,
      });
      workspace.addMetadata('TestFixture', 'ProcessDesignSimple', {
        sourceCode: `
          import { addTestFixture } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addTestFixture(
            ProcessDesign,
            async function simple() {
              const design = await ProcessDesign.create({ name: "Test" });
              return design;
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static testFixtures = {');
      expect(result).toContain('async simple()');
    });

    it('should collect imports from fixture files', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessInstance', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessInstance extends BusinessObject {
            id!: string;
          }
        `,
      });
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {
            id!: string;
          }
        `,
      });
      workspace.addMetadata('TestFixture', 'ProcessInstanceStarted', {
        sourceCode: `
          import { addTestFixture } from '@apexdesigner/dsl';
          import { ProcessInstance, ProcessDesign } from '@business-objects';
          addTestFixture(
            ProcessInstance,
            async function started() {
              const design = await ProcessDesign.testFixtures.simpleUserTask();
              const instance = await ProcessInstance.create({ designId: design.id });
              return instance;
            }
          );
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'ProcessInstance')!;
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { ProcessDesign } from "./process-design.js"');
    });

    it('should resolve TestFixture metadata to parent BO output path', () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {}
        `,
      });
      workspace.addMetadata('TestFixture', 'ProcessDesignSimple', {
        sourceCode: `
          import { addTestFixture } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          addTestFixture(
            ProcessDesign,
            async function simple() {
              return ProcessDesign.create({ name: "Test" });
            }
          );
        `,
      });

      const fixtureMeta = workspace.context.listMetadata('TestFixture')[0];
      const outputs = businessObjectGenerator.outputs(fixtureMeta);

      expect(outputs).toEqual(['server/src/business-objects/process-design.ts']);
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

  describe('lifecycle behaviors', () => {
    // Helper: create workspace with a BO and a lifecycle behavior
    function createLifecycleWorkspace(type: string, funcName: string, funcParams: string, funcBody: string) {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            id!: number;
          }
        `,
      });
      workspace.addMetadata('Behavior', `Order${funcName}`, {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { Order } from '@business-objects';
          addBehavior(
            Order,
            { type: '${type}' },
            async function ${funcName}(${funcParams}) {
              ${funcBody}
            }
          );
        `,
      });
      return workspace;
    }

    // Helper: extract a method body from generated output
    function extractMethod(result: string, methodSignature: string, nextSignature?: string): string {
      const start = result.indexOf(methodSignature);
      if (start === -1) return '';
      if (nextSignature) {
        const end = result.indexOf(nextSignature, start + 1);
        return end > -1 ? result.substring(start, end) : result.substring(start);
      }
      return result.substring(start);
    }

    describe('Before Create', () => {
      const type = 'Before Create';
      const funcParams = 'dataItems: Partial<any>[]';
      const marker = "d.status = 'pending'";
      const funcBody = `for (const d of dataItems) { ${marker}; }`;

      it('should inline body in create() before the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'setDefaults', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async create(', 'static async createMany(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeLessThan(method.indexOf('this.dataSource.create('));
      });

      it('should inline body in createMany() before the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'setDefaults', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async createMany(', 'static async update(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeLessThan(method.indexOf('this.dataSource.createMany('));
      });
    });

    describe('After Create', () => {
      const type = 'After Create';
      const funcParams = 'instances: any[]';
      const marker = 'await notify(inst.id)';
      const funcBody = `for (const inst of instances) { ${marker}; }`;

      it('should inline body in create() after the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'sendNotification', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async create(', 'static async createMany(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeGreaterThan(method.indexOf('this.dataSource.create('));
      });

      it('should inline body in createMany() after the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'sendNotification', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async createMany(', 'static async update(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeGreaterThan(method.indexOf('this.dataSource.createMany('));
      });

      it('should provide mixinOptions for mixin behaviors with config', async () => {
        const workspace = createSimpleMockWorkspace();
        workspace.addMetadata('Mixin', 'HistoryTracking', {
          sourceCode: `
            import { Mixin } from '@apexdesigner/dsl';
            export interface HistoryTrackingConfig {
              historyModel: any;
              foreignKey: string;
            }
            export class HistoryTracking extends Mixin {}
          `,
        });
        workspace.addMetadata('BusinessObject', 'Token', {
          sourceCode: `
            import { BusinessObject } from '@apexdesigner/dsl';
            import { HistoryTracking } from '@mixins';
            import { applyHistoryTrackingMixin } from '@mixins';
            import { TokenHistory } from '@business-objects';
            export class Token extends BusinessObject {
              id!: string;
              static mixins = [HistoryTracking];
            }
            applyHistoryTrackingMixin(Token, { historyModel: TokenHistory, foreignKey: "tokenId" });
          `,
        });
        workspace.addMetadata('BusinessObject', 'TokenHistory', {
          sourceCode: `
            import { BusinessObject } from '@apexdesigner/dsl';
            export class TokenHistory extends BusinessObject {
              id!: string;
            }
          `,
        });
        workspace.addMetadata('Behavior', 'HistoryTrackingCreateHistory', {
          sourceCode: `
            import { addBehavior } from '@apexdesigner/dsl';
            import { HistoryTracking, HistoryTrackingConfig } from '@mixins';
            addBehavior(
              HistoryTracking,
              { type: 'After Create' },
              async function createHistory(Model: any, mixinOptions: HistoryTrackingConfig, instances: any[]) {
                for (const instance of instances) {
                  await mixinOptions.historyModel.create({ [mixinOptions.foreignKey]: instance.id });
                }
              }
            );
          `,
        });

        const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'Token')!;
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

        // Body should be inlined with mixinOptions
        expect(result).toContain('mixinOptions.historyModel.create');
        // Should import TokenHistory (referenced in mixin apply options)
        expect(result).toContain('TokenHistory');
      });
    });

    describe('Before Update', () => {
      const type = 'Before Update';
      const funcParams = 'where: any, updates: Partial<any>';
      const marker = 'Cannot cancel order';
      const funcBody = `if (updates.status === 'cancelled') { throw new Error('${marker}'); }`;

      it('should inline body in update() before the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'validateUpdate', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async update(', 'static async updateById(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeLessThan(method.indexOf('this.dataSource.update('));
      });

      it('should inline body in updateById() before the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'validateUpdate', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async updateById(', 'static async upsert(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeLessThan(method.indexOf('this.dataSource.updateById('));
      });
    });

    describe('After Update', () => {
      const type = 'After Update';
      const funcParams = 'instances: any[]';
      const marker = 'await auditLog(inst.id)';
      const funcBody = `for (const inst of instances) { ${marker}; }`;

      it('should inline body in update() after the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'logChange', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async update(', 'static async updateById(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeGreaterThan(method.indexOf('this.dataSource.update('));
      });

      it('should inline body in updateById() after the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'logChange', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async updateById(', 'static async upsert(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeGreaterThan(method.indexOf('this.dataSource.updateById('));
      });
    });

    describe('Before Delete', () => {
      const type = 'Before Delete';
      const funcParams = 'where: any';
      const marker = 'Cannot delete active orders';
      const funcBody = `const count = await Order.count({ ...where, status: 'active' }); if (count > 0) throw new Error('${marker}');`;

      it('should inline body in delete() before the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'preventActive', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async delete(', 'static async deleteById(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeLessThan(method.indexOf('this.dataSource.delete('));
      });

      it('should inline body in deleteById() before the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'preventActive', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async deleteById(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeLessThan(method.indexOf('this.dataSource.deleteById('));
      });
    });

    describe('After Delete', () => {
      const type = 'After Delete';
      const funcParams = 'instances: any[]';
      const marker = 'await deleteFiles(inst.id)';
      const funcBody = `for (const inst of instances) { ${marker}; }`;

      it('should inline body in delete() after the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'cleanupFiles', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async delete(', 'static async deleteById(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeGreaterThan(method.indexOf('this.dataSource.delete('));
      });

      it('should inline body in deleteById() after the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'cleanupFiles', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async deleteById(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeGreaterThan(method.indexOf('this.dataSource.deleteById('));
      });
    });

    describe('Before Read', () => {
      const type = 'Before Read';
      const funcParams = 'where: any';
      const marker = 'where.deleted = false';
      const funcBody = `if (!where.deleted) { ${marker}; }`;

      it('should inline body in find() before the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'addDefaultFilter', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async find(', 'static async findOne(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeLessThan(method.indexOf('this.dataSource.find('));
      });
    });

    describe('After Read', () => {
      const type = 'After Read';
      const funcParams = 'instances: any[]';
      const marker = 'inst.isLoaded = true';
      const funcBody = `for (const inst of instances) { ${marker}; }`;

      it('should inline body in find() after the dataSource call', async () => {
        const workspace = createLifecycleWorkspace(type, 'markLoaded', funcParams, funcBody);
        const metadata = workspace.context.listMetadata('BusinessObject')[0];
        const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;
        const method = extractMethod(result, 'static async find(', 'static async findOne(');

        expect(method).toContain(marker);
        expect(method.indexOf(marker)).toBeGreaterThan(method.indexOf('this.dataSource.find('));
      });
    });
  });

  describe('view-backed business objects', () => {
    it('should only generate read-only methods when setView is present', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'LatestProcessDesign', {
        sourceCode: `
          import { BusinessObject, setView } from '@apexdesigner/dsl';
          export class LatestProcessDesign extends BusinessObject {
            id!: number;
            name?: string;
          }
          setView(LatestProcessDesign, \`SELECT * FROM process_design\`);
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectGenerator.generate(metadata, workspace.context)) as string;

      // Should have read methods
      expect(result).toContain('static async find(');
      expect(result).toContain('static async findOne(');
      expect(result).toContain('static async findById(');
      expect(result).toContain('static async count(');

      // Should NOT have write methods
      expect(result).not.toContain('static async create(');
      expect(result).not.toContain('static async createMany(');
      expect(result).not.toContain('static async update(');
      expect(result).not.toContain('static async updateById(');
      expect(result).not.toContain('static async upsert(');
      expect(result).not.toContain('static async delete(');
      expect(result).not.toContain('static async deleteById(');
      expect(result).not.toContain('static async findOrCreate(');
    });
  });
});
