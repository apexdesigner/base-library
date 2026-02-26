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
        `,
      });

      const metadata = workspace.context.listMetadata('DataSource')[0];
      await expect(dataSourceGenerator.generate(metadata, workspace.context))
        .rejects.toThrow('requires a rootDir configuration option');
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
        `,
      });

      const metadata = workspace.context.listMetadata('DataSource')[0];
      const result = await dataSourceGenerator.generate(metadata, workspace.context);
      expect(result).toBeDefined();
    });
  });
});
