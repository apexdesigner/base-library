import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { packageServiceGenerator } from './package-service.generator.js';
import { createSimpleMockWorkspace, createMockWorkspace } from '@apexdesigner/generator';

function getOutput(result: Map<string, string>, path: string): string {
  return result.get(path)!;
}

const SERVICE_PATH = 'client/src/app/services/package/package.service.ts';
const TYPE_PATH = 'design/@types/services/package.d.ts';

describe('packageServiceGenerator', () => {
  describe('outputs', () => {
    it('should output service and type declaration', () => {
      const outputs = packageServiceGenerator.outputs({} as any);
      expect(outputs).toEqual([SERVICE_PATH, TYPE_PATH]);
    });
  });

  describe('triggers', () => {
    it('should trigger on Project metadata', () => {
      const trigger = packageServiceGenerator.triggers.find(t => t.metadataType === 'Project');
      expect(trigger).toBeDefined();
    });
  });

  describe('generated service', () => {
    it('should generate an @Injectable service with values from root package.json', async () => {
      const workspace = await createMockWorkspace({
        useTempDir: true,
        projectSourceCode: `
          import { Project } from '@apexdesigner/dsl';
          export class MyApp extends Project {
            displayName = 'My Application';
          }
        `
      });
      writeFileSync(
        join(workspace.context.workspacePath, 'package.json'),
        JSON.stringify({ name: 'my-app', version: '2.5.0', description: 'A sample application' })
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await packageServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("@Injectable({ providedIn: 'root' })");
      expect(ts).toContain('export class PackageService');
      expect(ts).toContain("readonly name = 'my-app'");
      expect(ts).toContain("readonly version = '2.5.0'");
      expect(ts).toContain("readonly description = 'A sample application'");
      expect(ts).toContain("readonly displayName = 'My Application'");
    });

    it('should fall back to defaults when root package.json has no version', async () => {
      const workspace = createSimpleMockWorkspace({
        projectSourceCode: `
          import { Project } from '@apexdesigner/dsl';
          export class MyApp extends Project {}
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await packageServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("readonly name = 'test-project'");
      expect(ts).toContain("readonly version = '0.0.1'");
      expect(ts).toContain("readonly description = ''");
    });
  });

  describe('type declaration', () => {
    it('should generate a declare class with readonly properties', async () => {
      const workspace = createSimpleMockWorkspace({
        projectSourceCode: `
          import { Project } from '@apexdesigner/dsl';
          export class MyApp extends Project {}
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await packageServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = getOutput(result, TYPE_PATH);

      expect(dts).toContain('export declare class PackageService');
      expect(dts).toContain('readonly name: string');
      expect(dts).toContain('readonly version: string');
      expect(dts).toContain('readonly description: string');
      expect(dts).toContain('readonly displayName: string');
    });
  });
});
