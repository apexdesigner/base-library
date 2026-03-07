import { describe, it, expect } from 'vitest';
import { dataSourceGenerator } from './data-source.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('dataSourceGenerator', () => {
  describe('validation', () => {
    it('should throw if File data source is missing rootDir', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('DataSource', 'TestFile', {
        sourceCode: `
          import { DataSource } from '@apexdesigner/dsl';
          export class TestFile extends DataSource {
            configuration = {
              persistenceType: "File",
            };
          }
        `
      });

      const metadata = workspace.context.listMetadata('DataSource')[0];
      await expect(dataSourceGenerator.generate(metadata, workspace.context)).rejects.toThrow('requires a rootDir configuration option');
    });

    it('should not throw if File data source has rootDir', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('DataSource', 'TestFile', {
        sourceCode: `
          import { DataSource } from '@apexdesigner/dsl';
          export class TestFile extends DataSource {
            configuration = {
              persistenceType: "File",
              rootDir: "./data",
            };
          }
        `
      });

      const metadata = workspace.context.listMetadata('DataSource')[0];
      const result = await dataSourceGenerator.generate(metadata, workspace.context);
      expect(result).toBeDefined();
    });
  });

  it('should use isDefault on DataSource to determine the default data source', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('DataSource', 'Postgres', {
      sourceCode: `
          import { DataSource } from '@apexdesigner/dsl';
          export class Postgres extends DataSource {
            isDefault = true;
            defaultIdType = Number;
            configuration = {
              persistenceType: 'postgres',
            };
          }
        `
    });
    workspace.addMetadata('DataSource', 'FileBased', {
      sourceCode: `
          import { DataSource } from '@apexdesigner/dsl';
          export class FileBased extends DataSource {
            configuration = {
              persistenceType: 'file',
              rootDir: './data',
            };
          }
        `
    });
    workspace.addMetadata('BusinessObject', 'User', {
      sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class User extends BusinessObject {
            id!: number;
          }
        `,
      dataSource: 'Postgres'
    });
    workspace.addMetadata('BusinessObject', 'Venue', {
      sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class Venue extends BusinessObject {
            id!: string;
          }
        `,
      dataSource: 'FileBased'
    });

    const metadata = workspace.context.listMetadata('DataSource')[0];
    const result = (await dataSourceGenerator.generate(metadata, workspace.context)) as string;

    // Postgres has isDefault = true, so it should be the default
    expect(result).toContain('defaultDataSource: "postgres"');
    expect(result).not.toContain('defaultDataSource: "fileBased"');
  });
});
