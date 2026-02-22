import { describe, it, expect } from 'vitest';
import { appTypeGenerator } from './app-type.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('appTypeGenerator', () => {
  describe('basic structure', () => {
    it('should generate App class with generic fallbacks when no metadata', async () => {
      const workspace = createSimpleMockWorkspace();

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('export declare class App {');
      expect(result).toContain('static dataSources: Record<string, any>');
      expect(result).toContain('static businessObjects: Record<string, any>');
      expect(result).toContain('static emit(name: string, value: any): void');
    });
  });

  describe('dataSources', () => {
    it('should generate typed dataSources property for each data source', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('DataSource', 'Postgres', {
        sourceCode: `
          import { DataSource } from '@apexdesigner/dsl';
          export class Postgres extends DataSource {}
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain("import type { Postgres } from './data-sources/postgres'");
      expect(result).toContain('static dataSources: {');
      expect(result).toContain('postgres: Postgres;');
    });
  });

  describe('businessObjects', () => {
    it('should generate typed businessObjects property for each business object', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BusinessObject', 'User', {
        sourceCode: `
          import { BusinessObject } from '@apexdesigner/dsl';
          export class User extends BusinessObject {}
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain("import type { User } from './business-objects/user'");
      expect(result).toContain('static businessObjects: {');
      expect(result).toContain('User: typeof User;');
    });
  });

  describe('class app behaviors', () => {
    it('should generate static method for class app behavior', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'PreprocessJson', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { type: 'Class Behavior' },
            async function preprocessJson(value: unknown): Promise<unknown> {}
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('static preprocessJson(value: unknown): Promise<unknown>');
    });

    it('should exclude lifecycle app behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('AppBehavior', 'AfterStart', {
        sourceCode: `
          import { addAppBehavior } from '@apexdesigner/dsl';
          addAppBehavior(
            { lifecycleStage: 'After Start' },
            async function afterStart() {}
          );
        `,
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appTypeGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('static afterStart(');
    });
  });
});
