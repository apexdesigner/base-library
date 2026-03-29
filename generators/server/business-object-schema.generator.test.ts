import { describe, it, expect } from 'vitest';
import { businessObjectSchemaGenerator } from './business-object-schema.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

function serverContent(result: Map<string, string>): string {
  for (const [key, value] of result) {
    if (key.startsWith('server/')) return value;
  }
  throw new Error('No server file found in result');
}

function clientContent(result: Map<string, string>): string {
  for (const [key, value] of result) {
    if (key.startsWith('client/')) return value;
  }
  throw new Error('No client file found in result');
}

describe('businessObjectSchemaGenerator', () => {
  describe('id column config', () => {
    it('should infer autoIncrement for plain number id on Postgres data source', async () => {
      const workspace = createSimpleMockWorkspace({
        projectSourceCode: `
          import { Project } from '@apexdesigner/dsl';
          export class MyProject extends Project {
            defaultDataSource = Postgres;
          }
        `
      });
      workspace.addMetadata('DataSource', 'Postgres', {
        sourceCode: `
          import { DataSource } from '@apexdesigner/dsl';
          export class Postgres extends DataSource {
            configuration = { persistenceType: 'Postgres' };
            isDefault = true;
          }
        `
      });
      workspace.addMetadata('BusinessObject', 'User', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class User extends BusinessObject {}
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.column({ autoIncrement: true, type: "INTEGER" })');
    });

    it('should not add autoIncrement when no data source', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Tag', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Tag extends BusinessObject {}
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).not.toContain('.column(');
    });

    it('should use explicit decorator column config over Postgres default', async () => {
      const workspace = createSimpleMockWorkspace({
        projectSourceCode: `
          import { Project } from '@apexdesigner/dsl';
          export class MyProject extends Project {
            defaultDataSource = Postgres;
          }
        `
      });
      workspace.addMetadata('DataSource', 'Postgres', {
        sourceCode: `
          import { DataSource } from '@apexdesigner/dsl';
          export class Postgres extends DataSource {
            configuration = { persistenceType: 'Postgres' };
          }
        `
      });
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject, property } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            @property({ isId: true, column: { type: 'BIGINT', autoIncrement: true } })
            id!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.column({ type: "BIGINT", autoIncrement: true })');
    });

    it('should pass through arbitrary column config from decorator on non-id property', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Product', {
        sourceCode: `
          import { BusinessObject, property } from '@apexdesigner/dsl';
          export class Product extends BusinessObject {
            @property({ column: { type: 'DECIMAL' } })
            price?: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.column({ type: "DECIMAL" })');
    });
  });

  describe('optional foreign keys', () => {
    it('should add .optional() to foreign key when the FK property has a question token', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ProcessInstance', {
        sourceCode: `
          import { BusinessObject, relationship } from '@apexdesigner/dsl';
          export class ProcessInstance extends BusinessObject {
            @relationship({ type: 'References' })
            parentProcessInstance?: ProcessInstance;
            parentProcessInstanceId?: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('parentProcessInstanceId: z.number()\n      .nullable()\n      .optional()');
    });

    it('should not add .optional() to foreign key when the FK property is required', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject, relationship } from '@apexdesigner/dsl';
          import { Customer } from '@business-objects';
          export class Order extends BusinessObject {
            @relationship({ type: 'Belongs To' })
            customer!: Customer;
            customerId!: number;
          }
        `
      });
      workspace.addMetadata('BusinessObject', 'Customer', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Customer extends BusinessObject {}
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'Order')!;
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('customerId: z.number()');
      expect(result).not.toContain('customerId: z.number()\n      .optional()');
    });
  });

  describe('base type property defaults', () => {
    it('should apply column config from setPropertyDefaults on a base type', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'Json', {
        sourceCode: `
          import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';
          export class Json extends BaseType<any> {}
          setPropertyDefaults(Json, { column: 'jsonb' });
        `
      });
      workspace.addMetadata('BusinessObject', 'Task', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { Json } from '@base-types';
          export class Task extends BusinessObject {
            data?: Json;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.column({ type: "jsonb" })');
    });

    it('should apply uuid column type from setPropertyDefaults on Uuid base type', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'Uuid', {
        sourceCode: `
          import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';
          export class Uuid extends BaseType<string> {}
          setPropertyDefaults(Uuid, { column: 'uuid' });
        `
      });
      workspace.addMetadata('BusinessObject', 'Token', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { Uuid } from '@base-types';
          export class Token extends BusinessObject {
            code?: Uuid;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.column({ type: "uuid" })');
    });

    it('should apply presentAs from setPropertyDefaults on a base type', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'Json', {
        sourceCode: `
          import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';
          export class Json extends BaseType<any> {}
          setPropertyDefaults(Json, { column: 'jsonb', presentAs: 'json' });
        `
      });
      workspace.addMetadata('BusinessObject', 'Task', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { Json } from '@base-types';
          export class Task extends BusinessObject {
            config?: Json;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.presentAs("json")');
    });
  });

  describe('autoFormat', () => {
    it('should apply autoFormat from @property options', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Task', {
        sourceCode: `
          import { BusinessObject, property } from '@apexdesigner/dsl';
          export class Task extends BusinessObject {
            @property({ autoFormat: 'camelCase' })
            variableName?: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.meta({ format: "camelCase" })');
    });

    it('should apply autoFormat from setPropertyDefaults on a base type', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'VariableName', {
        sourceCode: `
          import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';
          export class VariableName extends BaseType<string> {}
          setPropertyDefaults(VariableName, { autoFormat: 'camelCase' });
        `
      });
      workspace.addMetadata('BusinessObject', 'Task', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { VariableName } from '@base-types';
          export class Task extends BusinessObject {
            name?: VariableName;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.meta({ format: "camelCase" })');
    });

    it('should allow property-level autoFormat to override base type default', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'VariableName', {
        sourceCode: `
          import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';
          export class VariableName extends BaseType<string> {}
          setPropertyDefaults(VariableName, { autoFormat: 'camelCase' });
        `
      });
      workspace.addMetadata('BusinessObject', 'Task', {
        sourceCode: `
          import { BusinessObject, property } from '@apexdesigner/dsl';
          import { VariableName } from '@base-types';
          export class Task extends BusinessObject {
            @property({ autoFormat: 'pascalCase' })
            name?: VariableName;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.meta({ format: "pascalCase" })');
      expect(result).not.toContain('.meta({ format: "camelCase" })');
    });
  });

  describe('foreign key visibility', () => {
    it('should hide FK for belongs-to relationships', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Department', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Department extends BusinessObject {
            name?: string;
          }
        `
      });
      workspace.addMetadata('BusinessObject', 'Employee', {
        sourceCode: `
          import { BusinessObject, relationship } from '@apexdesigner/dsl';
          import { Department } from '@business-objects';
          export class Employee extends BusinessObject {
            name?: string;
            @relationship({ type: 'Belongs To' })
            department?: Department;
            departmentId!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'Employee')!;
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('departmentId');
      expect(result).toContain('.hidden()');
    });

    it('should NOT hide FK for references relationships', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Department', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Department extends BusinessObject {
            name?: string;
          }
        `
      });
      workspace.addMetadata('BusinessObject', 'Employee', {
        sourceCode: `
          import { BusinessObject, relationship } from '@apexdesigner/dsl';
          import { Department } from '@business-objects';
          export class Employee extends BusinessObject {
            name?: string;
            @relationship({ type: 'References' })
            department?: Department;
            departmentId!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'Employee')!;
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('departmentId');
      const fkLine = result.split('\n').find(l => l.includes('departmentId'));
      expect(fkLine).not.toContain('.hidden()');
    });

    it('should default presentAs to foreignKey for references relationships', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Department', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Department extends BusinessObject {
            name?: string;
          }
        `
      });
      workspace.addMetadata('BusinessObject', 'Employee', {
        sourceCode: `
          import { BusinessObject, relationship } from '@apexdesigner/dsl';
          import { Department } from '@business-objects';
          export class Employee extends BusinessObject {
            name?: string;
            @relationship({ type: 'References' })
            department?: Department;
            departmentId!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'Employee')!;
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.presentAs("reference")');
    });

    it('should respect explicit presentAs on references FK', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Department', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Department extends BusinessObject {
            name?: string;
          }
        `
      });
      workspace.addMetadata('BusinessObject', 'Employee', {
        sourceCode: `
          import { BusinessObject, property, relationship } from '@apexdesigner/dsl';
          import { Department } from '@business-objects';
          export class Employee extends BusinessObject {
            name?: string;
            @relationship({ type: 'References' })
            department?: Department;
            @property({ presentAs: 'select' })
            departmentId!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'Employee')!;
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.presentAs("select")');
      expect(result).not.toContain('.presentAs("reference")');
    });
  });

  describe('conditional rules', () => {
    it('should extract arrow function body for excludeWhen', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Project', {
        sourceCode: `
          import { BusinessObject, property } from '@apexdesigner/dsl';
          export class Project extends BusinessObject {
            name?: string;
            @property({ excludeWhen: (project) => project.name?.startsWith('A') })
            description?: string;
          }
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.excludeWhen("name?.startsWith(');
      expect(result).not.toContain('(project) =>');
    });

    it('should extract arrow function body for requiredWhen with message', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Invoice', {
        sourceCode: `
          import { BusinessObject, property } from '@apexdesigner/dsl';
          export class Invoice extends BusinessObject {
            total?: number;
            @property({ requiredWhen: { condition: (invoice) => invoice.total > 1000, message: 'Required for large orders' } })
            approval?: string;
          }
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.requiredWhen("total > 1000"');
      expect(result).toContain('Required for large orders');
      expect(result).not.toContain('(invoice) =>');
    });

    it('should extract arrow function body for disabledWhen', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Task', {
        sourceCode: `
          import { BusinessObject, property } from '@apexdesigner/dsl';
          export class Task extends BusinessObject {
            status?: string;
            @property({ disabledWhen: (task) => task.status === 'complete' })
            name?: string;
          }
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain(".disabledWhen(\"status === 'complete'\")");
      expect(result).not.toContain('(task) =>');
    });
  });

  describe('base type valid values', () => {
    it('should generate z.enum() for base type with simple string valid values', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'ProcessDesignHistoryEventType', {
        sourceCode: `
          import { BaseType, applyValidValues } from '@apexdesigner/dsl';
          export class ProcessDesignHistoryEventType extends BaseType<string> {}
          applyValidValues(ProcessDesignHistoryEventType, [
            "Deployed",
            "Suspended",
            "Resumed",
            "Replaced",
          ]);
        `
      });
      workspace.addMetadata('BusinessObject', 'ProcessDesignHistory', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { ProcessDesignHistoryEventType } from '@base-types';
          export class ProcessDesignHistory extends BusinessObject {
            eventType?: ProcessDesignHistoryEventType;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('z.enum(["Deployed", "Suspended", "Resumed", "Replaced"])');
      expect(result).not.toContain('z.unknown()');
    });

    it('should generate z.enum() for base type with object valid values using value property', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'Status', {
        sourceCode: `
          import { BaseType, applyValidValues } from '@apexdesigner/dsl';
          export class Status extends BaseType<string> {}
          applyValidValues(Status, [
            { name: "Active", value: "active" },
            { name: "Inactive", value: "inactive" },
          ]);
        `
      });
      workspace.addMetadata('BusinessObject', 'Account', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { Status } from '@base-types';
          export class Account extends BusinessObject {
            status?: Status;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('z.enum(["active", "inactive"])');
      expect(result).not.toContain('z.unknown()');
    });

    it('should resolve base type to native zod type when no valid values or column defaults are set', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'Email', {
        sourceCode: `
          import { BaseType, applyValidation } from '@apexdesigner/dsl';
          export class Email extends BaseType<string> {}
          applyValidation(Email, {
            pattern: "^[^@]+@[^@]+\\\\.[^@]+$",
            patternMessage: "Must be a valid email address",
          });
        `
      });
      workspace.addMetadata('BusinessObject', 'ProcessAdmin', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          import { Email } from '@base-types';
          export class ProcessAdmin extends BusinessObject {
            email!: Email;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('email: z.string()');
      expect(result).not.toContain('z.unknown()');
    });
  });

  describe('base type id and foreign key handling', () => {
    it('should use z.string() with column defaults for id when defaultIdType is a base type', async () => {
      const workspace = createSimpleMockWorkspace({
        projectSourceCode: `
          import { Project } from '@apexdesigner/dsl';
          export class MyProject extends Project {
            defaultDataSource = Postgres;
          }
        `
      });
      workspace.addMetadata('DataSource', 'Postgres', {
        sourceCode: `
          import { DataSource } from '@apexdesigner/dsl';
          import { Uuid } from '@base-types';
          export class Postgres extends DataSource {
            configuration = { persistenceType: 'Postgres' };
            defaultIdType = Uuid;
            isDefault = true;
          }
        `
      });
      workspace.addMetadata('BaseType', 'Uuid', {
        sourceCode: `
          import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';
          export class Uuid extends BaseType<string> {}
          setPropertyDefaults(Uuid, { column: 'uuid' });
        `
      });
      workspace.addMetadata('BusinessObject', 'ProcessInstance', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessInstance extends BusinessObject {}
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('id: z.uuid()');
      expect(result).toContain('.column({ type: "uuid" })');
      expect(result).not.toContain('z.number()');
      expect(result).not.toContain('INTEGER');
    });

    it('should use z.string() with column defaults for FK when id type is a base type', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('DataSource', 'Postgres', {
        sourceCode: `
          import { DataSource } from '@apexdesigner/dsl';
          import { Uuid } from '@base-types';
          export class Postgres extends DataSource {
            configuration = { persistenceType: 'Postgres' };
            defaultIdType = Uuid;
            isDefault = true;
          }
        `
      });
      workspace.addMetadata('BaseType', 'Uuid', {
        sourceCode: `
          import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';
          export class Uuid extends BaseType<string> {}
          setPropertyDefaults(Uuid, { column: 'uuid' });
        `
      });
      workspace.addMetadata('BusinessObject', 'ProcessDesign', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class ProcessDesign extends BusinessObject {}
        `
      });
      workspace.addMetadata('BusinessObject', 'ProcessInstance', {
        sourceCode: `
          import { BusinessObject, relationship } from '@apexdesigner/dsl';
          import { ProcessDesign } from '@business-objects';
          export class ProcessInstance extends BusinessObject {
            @relationship({ type: 'Belongs To' })
            processDesign!: ProcessDesign;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'ProcessInstance')!;
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('processDesignId: z.uuid()');
      expect(result).toContain('.column({ type: "uuid" })');
      expect(result).not.toContain('processDesignId: z.number()');
      expect(result).not.toContain('INTEGER');
    });
  });

  describe('view-backed business objects', () => {
    it('should chain .view() with SQL on the schema when setView is present', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'LatestProcessDesign', {
        sourceCode: `
          import { BusinessObject, setView } from '@apexdesigner/dsl';
          export class LatestProcessDesign extends BusinessObject {
            id!: number;
            name?: string;
            version?: number;
          }
          setView(LatestProcessDesign, \`
            SELECT DISTINCT ON (pd.design_uuid)
              pd.id, pd.name, pd.version
            FROM process_design pd
            ORDER BY pd.design_uuid, pd.version DESC
          \`);
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.view({');
      expect(result).toContain('sql:');
      expect(result).toContain('SELECT DISTINCT ON');
    });
  });

  describe('client output', () => {
    it('should strip .column(), .unique(), .index() from client schemas', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'User', {
        sourceCode: `
          import { BusinessObject, addUniqueConstraint, addIndex } from '@apexdesigner/dsl';
          export class User extends BusinessObject {
            email!: string;
          }
          addUniqueConstraint(User, { fields: ['email'] });
          addIndex(User, { name: 'user_email_idx', properties: [{ name: 'email' }] });
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = clientContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).not.toContain('.column(');
      expect(result).not.toContain('.unique(');
      expect(result).not.toContain('.index(');
      expect(result).not.toContain('schema-persistence');
      expect(result).toContain('.describe(');
      expect(result).toContain('.as("User")');
    });

    it('should strip multi-line .view() from client schemas', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'LatestProcessDesign', {
        sourceCode: `
          import { BusinessObject, setView } from '@apexdesigner/dsl';
          export class LatestProcessDesign extends BusinessObject {
            id!: number;
            name?: string;
            version?: number;
          }
          setView(LatestProcessDesign, \`
            SELECT DISTINCT ON (pd.design_uuid)
              pd.id, pd.name, pd.version
            FROM process_design pd
            ORDER BY pd.design_uuid, pd.version DESC
          \`);
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = clientContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).not.toContain('.view(');
      expect(result).not.toContain('SELECT');
      expect(result).not.toContain('schema-persistence');
      expect(result).toContain('.as("LatestProcessDesign")');
    });
  });

  describe('unique constraints', () => {
    it('should emit .unique() for addUniqueConstraint with object form', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'User', {
        sourceCode: `
          import { BusinessObject, addUniqueConstraint } from '@apexdesigner/dsl';
          export class User extends BusinessObject {
            email!: string;
          }
          addUniqueConstraint(User, { fields: ['email'] });
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.unique({ fields: ["email"] })');
    });

    it('should emit .unique() for addUniqueConstraint with string args', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Role', {
        sourceCode: `
          import { BusinessObject, addUniqueConstraint } from '@apexdesigner/dsl';
          export class Role extends BusinessObject {
            name!: string;
          }
          addUniqueConstraint(Role, 'name');
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.unique({ fields: ["name"] })');
    });

    it('should emit .unique() for composite unique constraint', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Assignment', {
        sourceCode: `
          import { BusinessObject, addUniqueConstraint } from '@apexdesigner/dsl';
          export class Assignment extends BusinessObject {
            userId!: number;
            roleId!: number;
          }
          addUniqueConstraint(Assignment, { fields: ['userId', 'roleId'] });
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.unique({ fields: ["userId", "roleId"] })');
    });

    it('should emit multiple .unique() calls for multiple constraints', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'User', {
        sourceCode: `
          import { BusinessObject, addUniqueConstraint } from '@apexdesigner/dsl';
          export class User extends BusinessObject {
            email!: string;
            slug!: string;
          }
          addUniqueConstraint(User, { fields: ['email'] });
          addUniqueConstraint(User, { fields: ['slug'] });
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.unique({ fields: ["email"] })');
      expect(result).toContain('.unique({ fields: ["slug"] })');
    });

    it('should pass through name from addUniqueConstraint to .unique()', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'ActivityAssignment', {
        sourceCode: `
          import { BusinessObject, addUniqueConstraint } from '@apexdesigner/dsl';
          export class ActivityAssignment extends BusinessObject {
            termId!: number;
            tutorId!: number;
            slotId!: number;
          }
          addUniqueConstraint(ActivityAssignment, { name: 'aa_term_tutor_slot', fields: ['termId', 'tutorId', 'slotId'] });
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.unique({ name: "aa_term_tutor_slot", fields: ["termId", "tutorId", "slotId"] })');
    });

    it('should omit name when addUniqueConstraint does not provide one', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'User', {
        sourceCode: `
          import { BusinessObject, addUniqueConstraint } from '@apexdesigner/dsl';
          export class User extends BusinessObject {
            email!: string;
          }
          addUniqueConstraint(User, { fields: ['email'] });
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.unique({ fields: ["email"] })');
      expect(result).not.toContain('name:');
    });
  });

  describe('onDelete', () => {
    it('should emit .onDelete() when relationship has onDelete option', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Token', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Token extends BusinessObject {}
        `
      });
      workspace.addMetadata('BusinessObject', 'ProcessInstance', {
        sourceCode: `
          import { BusinessObject, relationship } from '@apexdesigner/dsl';
          import { Token } from '@business-objects';
          export class ProcessInstance extends BusinessObject {
            @relationship({ type: 'References', onDelete: 'Cascade' })
            parentToken?: Token;
            parentTokenId?: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'ProcessInstance')!;
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.onDelete("CASCADE")');
    });

    it('should not emit .onDelete() when relationship has no onDelete option', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Category', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Category extends BusinessObject {}
        `
      });
      workspace.addMetadata('BusinessObject', 'Post', {
        sourceCode: `
          import { BusinessObject, relationship } from '@apexdesigner/dsl';
          import { Category } from '@business-objects';
          export class Post extends BusinessObject {
            @relationship({ type: 'References' })
            category?: Category;
            categoryId?: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'Post')!;
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).not.toContain('.onDelete(');
    });

    it('should strip .onDelete() from client schemas', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Token', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Token extends BusinessObject {}
        `
      });
      workspace.addMetadata('BusinessObject', 'ProcessInstance', {
        sourceCode: `
          import { BusinessObject, relationship } from '@apexdesigner/dsl';
          import { Token } from '@business-objects';
          export class ProcessInstance extends BusinessObject {
            @relationship({ type: 'References', onDelete: 'Cascade' })
            parentToken?: Token;
            parentTokenId?: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject').find(m => m.name === 'ProcessInstance')!;
      const result = clientContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).not.toContain('.onDelete(');
    });
  });

  describe('indexes', () => {
    it('should emit .index() for addIndex on a single field', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'User', {
        sourceCode: `
          import { BusinessObject, addIndex } from '@apexdesigner/dsl';
          export class User extends BusinessObject {
            email!: string;
          }
          addIndex(User, { name: 'user_email_idx', properties: [{ name: 'email' }] });
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.index({ name: "user_email_idx", properties: [{ name: "email" }] })');
    });

    it('should emit .index() for composite index', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Task', {
        sourceCode: `
          import { BusinessObject, addIndex } from '@apexdesigner/dsl';
          export class Task extends BusinessObject {
            projectId!: number;
            status!: string;
          }
          addIndex(Task, { name: 'task_project_id_status_idx', properties: [{ name: 'projectId' }, { name: 'status' }] });
        `
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = serverContent((await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as Map<string, string>);

      expect(result).toContain('.index({ name: "task_project_id_status_idx", properties: [{ name: "projectId" }, { name: "status" }] })');
    });
  });
});
