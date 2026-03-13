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

  describe('component metadata', () => {
    it('should include name, selector, and description for each component', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      workspace.addMetadata('Component', 'AddButtonComponent', {
        sourceCode: `
          import { Component } from '@apexdesigner/dsl/component';

          /**
           * Add Button
           *
           * A button that opens a dialog for adding a new record.
           */
          export class AddButtonComponent extends Component {}
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("name: 'AddButton'");
      expect(ts).toContain("selector: 'add-button'");
      expect(ts).toContain("displayName: 'Add Button'");
      expect(ts).toContain("description: 'A button that opens a dialog for adding a new record.'");
    });

    it('should extract inputs with name and type', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      workspace.addMetadata('Component', 'AddButtonComponent', {
        sourceCode: `
          import { Component, property } from '@apexdesigner/dsl/component';

          /** Add Button */
          export class AddButtonComponent extends Component {
            @property({ isInput: true })
            label?: string;

            @property({ isInput: true })
            count!: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("{ name: 'label', type: 'string' }");
      expect(ts).toContain("{ name: 'count', type: 'number' }");
    });

    it('should extract outputs with name and type', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      workspace.addMetadata('Component', 'TestDialogComponent', {
        sourceCode: `
          import { Component, property } from '@apexdesigner/dsl/component';
          import { EventEmitter } from '@angular/core';

          /** Test Dialog */
          export class TestDialogComponent extends Component {
            @property({ isOutput: true })
            saved!: EventEmitter<void>;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("{ name: 'saved', type: 'EventEmitter<void>' }");
    });

    it('should include isDialog, isCustomElement, and allowChildren flags', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      workspace.addMetadata('Component', 'TestDialogComponent', {
        sourceCode: `
          import { Component, component } from '@apexdesigner/dsl/component';

          /** Test Dialog */
          @component({ isDialog: true })
          export class TestDialogComponent extends Component {}
        `
      });
      workspace.addMetadata('Component', 'BreadcrumbComponent', {
        sourceCode: `
          import { Component, component } from '@apexdesigner/dsl/component';

          /** Breadcrumb */
          @component({ allowChildren: true })
          export class BreadcrumbComponent extends Component {}
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      // Dialog should have isDialog: true
      const dialogSection = ts.split("name: 'TestDialog'")[1]?.split('    },')[0] || '';
      expect(dialogSection).toContain('isDialog: true');

      // Breadcrumb should have allowChildren: true
      const breadcrumbSection = ts.split("name: 'Breadcrumb'")[1]?.split('    },')[0] || '';
      expect(breadcrumbSection).toContain('allowChildren: true');
    });

    it('should default flags to false and metadata to empty when not set', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      workspace.addMetadata('Component', 'PlainComponent', {
        sourceCode: `
          import { Component } from '@apexdesigner/dsl/component';

          /** Plain */
          export class PlainComponent extends Component {}
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const section = ts.split("name: 'Plain'")[1]?.split('    },')[0] || '';
      expect(section).toContain('isDialog: false');
      expect(section).toContain('isCustomElement: false');
      expect(section).toContain('allowChildren: false');
      expect(section).not.toContain('metadata:');
    });

    it('should extract metadata from @component() decorator', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      workspace.addMetadata('Component', 'SelectUserFieldComponent', {
        sourceCode: `
          import { Component, component } from '@apexdesigner/dsl/component';

          /** Select User Field */
          @component({ metadata: { fieldType: 'select-user', category: 'form' } })
          export class SelectUserFieldComponent extends Component {}
        `
      });

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const section = ts.split("name: 'SelectUserField'")[1]?.split('},')[0] || '';
      expect(section).toContain('"fieldType":"select-user"');
      expect(section).toContain('"category":"form"');
    });

    it('should include ComponentMetadata type in type declaration', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addComponent(workspace, 'BreadcrumbComponent');

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await componentServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = getOutput(result, TYPE_PATH);

      expect(dts).toContain('interface ComponentMetadata');
      expect(dts).toContain('readonly metadata: readonly ComponentMetadata[]');
      expect(dts).toContain('getMetadata(name: string): ComponentMetadata | undefined');
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
