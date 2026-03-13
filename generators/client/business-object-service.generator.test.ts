import { describe, it, expect } from 'vitest';
import { businessObjectServiceGenerator } from './business-object-service.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

function getOutput(result: Map<string, string>, path: string): string {
  return result.get(path)!;
}

const SERVICE_PATH = 'client/src/app/services/business-object/business-object.service.ts';
const TYPE_PATH = 'design/@types/services/business-object.d.ts';

function addBusinessObject(workspace: ReturnType<typeof createSimpleMockWorkspace>, name: string, sourceCode?: string) {
  workspace.addMetadata('BusinessObject', name, {
    sourceCode:
      sourceCode ||
      `
      import { BusinessObject } from '@apexdesigner/dsl';
      export class ${name} extends BusinessObject {
        id!: number;
      }
    `
  });
}

function addProject(workspace: ReturnType<typeof createSimpleMockWorkspace>, name = 'TestProject') {
  workspace.addMetadata('Project', name, {
    sourceCode: `
      import { Project } from '@apexdesigner/dsl';
      export class ${name} extends Project {}
    `
  });
}

describe('businessObjectServiceGenerator', () => {
  describe('outputs', () => {
    it('should output service and type declaration', () => {
      const outputs = businessObjectServiceGenerator.outputs({} as any);
      expect(outputs).toEqual([SERVICE_PATH, TYPE_PATH]);
    });
  });

  describe('basic structure', () => {
    it('should generate an @Injectable service', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("@Injectable({ providedIn: 'root' })");
      expect(ts).toContain('export class BusinessObjectService');
    });

    it('should include business object names array', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');
      addBusinessObject(workspace, 'Token');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("'Task'");
      expect(ts).toContain("'Token'");
    });
  });

  describe('loadFormGroup', () => {
    it('should generate a loadFormGroup method', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('async loadFormGroup(');
      expect(ts).toContain('form-group');
    });
  });

  describe('loadFormArray', () => {
    it('should generate a loadFormArray method', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('async loadFormArray(');
    });
  });

  describe('loadPersistedArray', () => {
    it('should generate a loadPersistedArray method', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('async loadPersistedArray(');
    });
  });

  describe('loadEntity', () => {
    it('should generate a loadEntity method', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('async loadEntity(');
    });
  });

  describe('parameterized imports', () => {
    it('should use parameterized import paths instead of switch/case', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      // All methods should use parameterized imports, not a switch/case per BO
      expect(ts).not.toContain('switch');
      expect(ts).toContain('import(`');
    });
  });

  describe('sorting', () => {
    it('should sort business objects alphabetically in names array', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Zebra');
      addBusinessObject(workspace, 'Alpha');
      addBusinessObject(workspace, 'Middle');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const alphaIndex = ts.indexOf("'Alpha'");
      const middleIndex = ts.indexOf("'Middle'");
      const zebraIndex = ts.indexOf("'Zebra'");
      expect(alphaIndex).toBeLessThan(middleIndex);
      expect(middleIndex).toBeLessThan(zebraIndex);
    });
  });

  describe('type declaration', () => {
    it('should generate type declaration with all method signatures and metadata types', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = getOutput(result, TYPE_PATH);

      expect(dts).toContain('export declare class BusinessObjectService');
      expect(dts).toContain('readonly names: readonly string[]');
      expect(dts).toContain('readonly metadata: readonly BusinessObjectMetadata[]');
      expect(dts).toContain('getMetadata(name: string): BusinessObjectMetadata | undefined');
      expect(dts).toContain('loadFormGroup(');
      expect(dts).toContain('loadFormArray(');
      expect(dts).toContain('loadPersistedArray(');
      expect(dts).toContain('loadEntity(');
      expect(dts).toContain('interface BusinessObjectMetadata');
      expect(dts).toContain('interface BusinessObjectProperty');
      expect(dts).toContain('interface BusinessObjectRelationship');
      expect(dts).toContain('interface BusinessObjectBehavior');
    });
  });

  describe('empty state', () => {
    it('should generate valid service with no business objects', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('readonly names = [] as const;');
      expect(ts).toContain('async loadFormGroup(');
    });
  });

  describe('debug namespace', () => {
    it('should use project name for debug namespace', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('createDebug("TestProject:BusinessObjectService")');
    });
  });

  describe('metadata', () => {
    it('should include name, displayName, and description', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(
        workspace,
        'Task',
        `
        import { BusinessObject } from '@apexdesigner/dsl';

        /**
         * Task
         *
         * A unit of work to be completed.
         */
        export class Task extends BusinessObject {
          id!: number;
        }
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("name: 'Task'");
      expect(ts).toContain("displayName: 'Task'");
      expect(ts).toContain("description: 'A unit of work to be completed.'");
    });

    it('should include properties with name and type', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(
        workspace,
        'Task',
        `
        import { BusinessObject } from '@apexdesigner/dsl';

        /** Task */
        export class Task extends BusinessObject {
          id!: number;
          title!: string;
          done?: boolean;
        }
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("{ name: 'id', type: 'number' }");
      expect(ts).toContain("{ name: 'title', type: 'string' }");
      expect(ts).toContain("{ name: 'done', type: 'boolean' }");
    });

    it('should include relationships with name, type, and kind', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(
        workspace,
        'Task',
        `
        import { BusinessObject, relationship } from '@apexdesigner/dsl';
        import { User } from '@business-objects';

        /** Task */
        export class Task extends BusinessObject {
          id!: number;

          @relationship({ type: 'Belongs To' })
          user?: User;
        }
      `
      );
      addBusinessObject(workspace, 'User');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const taskSection = ts.split("name: 'Task'")[1]?.split('    },')[0] || '';
      expect(taskSection).toContain("{ name: 'user', type: 'User', kind: 'belongsTo' }");
    });

    it('should include behaviors with name and metadata', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');
      workspace.addMetadata('Behavior', 'Task.findActive', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { Task } from '@business-objects';

          /** Find Active - Returns all active tasks */
          addBehavior(Task, { type: 'Class', metadata: { category: 'query' } }, async function findActive(): Promise<Task[]> {
            return [];
          });
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const taskSection = ts.split("name: 'Task'")[1]?.split('    },')[0] || '';
      expect(taskSection).toContain("name: 'findActive'");
      expect(taskSection).toContain('"category":"query"');
    });

    it('should exclude lifecycle behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');
      workspace.addMetadata('Behavior', 'Task.beforeCreate', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { Task } from '@business-objects';

          addBehavior(Task, { type: 'Before Create' }, async function beforeCreate(task: Task): Promise<void> {});
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).not.toContain("'beforeCreate'");
    });

    it('should omit metadata key when behavior has no metadata', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');
      workspace.addMetadata('Behavior', 'Task.findAll', {
        sourceCode: `
          import { addBehavior } from '@apexdesigner/dsl';
          import { Task } from '@business-objects';

          /** Find All */
          addBehavior(Task, { type: 'Class' }, async function findAll(): Promise<Task[]> {
            return [];
          });
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const taskSection = ts.split("name: 'Task'")[1]?.split('    },')[0] || '';
      expect(taskSection).toContain("name: 'findAll'");
      expect(taskSection).not.toContain('metadata:');
    });

    it('should include getMetadata method', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addBusinessObject(workspace, 'Task');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await businessObjectServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('getMetadata(name: string): BusinessObjectMetadata | undefined');
      expect(ts).toContain("return this.metadata.find(m => m.name === name)");
    });
  });
});
