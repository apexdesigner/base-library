import { describe, it, expect } from 'vitest';
import { componentServiceGenerator } from './component-service.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

function getOutput(result: Map<string, string>, path: string): string {
  return result.get(path)!;
}

const SERVICE_PATH = 'client/src/app/services/component/component.service.ts';
const TYPE_PATH = 'design/@types/services/component.d.ts';

function addComponent(workspace: ReturnType<typeof createSimpleMockWorkspace>, name: string) {
  workspace.addMetadata('Component', name, {
    sourceCode: `
      import { Component } from '@apexdesigner/dsl/component';
      export class ${name} extends Component {}
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

describe('componentServiceGenerator', () => {
  describe('outputs', () => {
    it('should output service and type declaration', () => {
      const outputs = componentServiceGenerator.outputs({} as any);
      expect(outputs).toEqual([SERVICE_PATH, TYPE_PATH]);
    });
  });

  describe('basic structure', () => {
    it('should generate an @Injectable service', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addComponent(workspace, 'BreadcrumbComponent');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("@Injectable({ providedIn: 'root' })");
      expect(ts).toContain('export class ComponentService');
    });

    it('should include component names array', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addComponent(workspace, 'BreadcrumbComponent');
      addComponent(workspace, 'SidebarComponent');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("readonly names = ['Breadcrumb', 'Sidebar'] as const;");
    });

    it('should generate loadComponent with dynamic imports', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addComponent(workspace, 'BreadcrumbComponent');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("case 'Breadcrumb':");
      expect(ts).toContain("import('../../components/breadcrumb/breadcrumb.component').then(m => m.BreadcrumbComponent)");
    });

    it('should throw for unknown component name', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addComponent(workspace, 'BreadcrumbComponent');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('throw new Error(`Unknown component: ${name}`)');
    });
  });

  describe('sorting', () => {
    it('should sort components alphabetically', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addComponent(workspace, 'ZebraComponent');
      addComponent(workspace, 'AlphaComponent');
      addComponent(workspace, 'MiddleComponent');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("readonly names = ['Alpha', 'Middle', 'Zebra'] as const;");

      const alphaIndex = ts.indexOf("case 'Alpha':");
      const middleIndex = ts.indexOf("case 'Middle':");
      const zebraIndex = ts.indexOf("case 'Zebra':");
      expect(alphaIndex).toBeLessThan(middleIndex);
      expect(middleIndex).toBeLessThan(zebraIndex);
    });
  });

  describe('filtering', () => {
    it('should exclude AppComponent', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addComponent(workspace, 'AppComponent');
      addComponent(workspace, 'BreadcrumbComponent');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).not.toContain("'App'");
      expect(ts).toContain("'Breadcrumb'");
    });
  });

  describe('type declaration', () => {
    it('should generate type declaration with loadComponent signature', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addComponent(workspace, 'BreadcrumbComponent');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = getOutput(result, TYPE_PATH);

      expect(dts).toContain('export declare class ComponentService');
      expect(dts).toContain('readonly names: readonly string[]');
      expect(dts).toContain('loadComponent(name: string): Promise<Type<any>>');
    });
  });

  describe('debug namespace', () => {
    it('should use project name for debug namespace', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addComponent(workspace, 'BreadcrumbComponent');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('createDebug("TestProject:ComponentService")');
    });
  });

  describe('empty state', () => {
    it('should generate valid service with no components', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('readonly names = [] as const;');
      expect(ts).toContain('async loadComponent(name: string)');
    });
  });
});
