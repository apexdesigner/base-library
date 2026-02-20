import { describe, it, expect } from 'vitest';
import { businessObjectSchemaGenerator } from './business-object-schema.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectSchemaGenerator', () => {
  describe('id column config', () => {
    it('should infer autoIncrement for plain number id on Postgres data source', async () => {
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
          export class Postgres extends DataSource {
            configuration = { persistenceType: 'Postgres' };
          }
        `,
      });
      workspace.addMetadata('BusinessObject', 'User', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class User extends BusinessObject {}
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('.column({ autoIncrement: true })');
    });

    it('should not add autoIncrement when no data source', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'Tag', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Tag extends BusinessObject {}
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('.column(');
    });

    it('should use explicit decorator column config over Postgres default', async () => {
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
          export class Postgres extends DataSource {
            configuration = { persistenceType: 'Postgres' };
          }
        `,
      });
      workspace.addMetadata('BusinessObject', 'Order', {
        sourceCode: `
          import { BusinessObject, property } from '@apexdesigner/dsl';
          export class Order extends BusinessObject {
            @property({ isId: true, column: { type: 'BIGINT', autoIncrement: true } })
            id!: number;
          }
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as string;

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
        `,
      });

      const metadata = workspace.context.listMetadata('BusinessObject')[0];
      const result = (await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('.column({ type: "DECIMAL" })');
    });
  });
});
