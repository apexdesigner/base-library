import { describe, it, expect } from 'vitest';
import { componentGenerator } from './component.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

async function generateComponent(sourceCode: string): Promise<string> {
  const workspace = createSimpleMockWorkspace();
  workspace.addMetadata('Component', 'Dashboard', { sourceCode });
  const metadata = workspace.context.listMetadata('Component')[0];
  const result = (await componentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
  return result.get('client/src/app/components/dashboard/dashboard.component.ts')!;
}

async function generateDialogOutputs(name: string, sourceCode: string): Promise<Map<string, string>> {
  const workspace = createSimpleMockWorkspace();
  workspace.addMetadata('Component', name, { sourceCode });
  const metadata = workspace.context.listMetadata('Component')[0];
  return (await componentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
}

describe('componentGenerator', () => {
  describe('callOnLoad', () => {
    it('should generate ngOnInit and call the method', async () => {
      const ts = await generateComponent(`
        import { Component, component, method } from '@apexdesigner/dsl/component';
        @component({})
        export class DashboardComponent extends Component {
          @method({ callOnLoad: true })
          loadData() {}
        }
      `);

      expect(ts).toContain('OnInit');
      expect(ts).toContain('ngOnInit()');
      expect(ts).toContain('this.loadData()');
    });
  });

  describe('callOnUnload', () => {
    it('should generate ngOnDestroy and call the method', async () => {
      const ts = await generateComponent(`
        import { Component, component, method } from '@apexdesigner/dsl/component';
        @component({})
        export class DashboardComponent extends Component {
          @method({ callOnUnload: true })
          cleanup() {}
        }
      `);

      expect(ts).toContain('OnDestroy');
      expect(ts).toContain('ngOnDestroy()');
      expect(ts).toContain('this.cleanup()');
    });
  });

  describe('callAfterLoad', () => {
    it('should generate ngAfterViewInit and call the method', async () => {
      const ts = await generateComponent(`
        import { Component, component, method } from '@apexdesigner/dsl/component';
        @component({})
        export class DashboardComponent extends Component {
          @method({ callAfterLoad: true })
          initChart() {}
        }
      `);

      expect(ts).toContain('AfterViewInit');
      expect(ts).toContain('ngAfterViewInit()');
      expect(ts).toContain('this.initChart()');
    });
  });

  describe('isDialog', () => {
    it('should output a wrapper component file alongside the content component', async () => {
      const outputs = await generateDialogOutputs(
        'AddItemDialog',
        `
        import { Component, component, property } from '@apexdesigner/dsl/component';
        @component({ isDialog: true })
        export class AddItemDialogComponent extends Component {
          @property({ isInput: true })
          title!: string;
        }
      `
      );

      const wrapperPath = 'client/src/app/components/add-item-dialog/add-item-dialog.component.ts';
      const contentPath = 'client/src/app/components/add-item-dialog/add-item-dialog-content.component.ts';

      expect(outputs.has(wrapperPath)).toBe(true);
      expect(outputs.has(contentPath)).toBe(true);
    });

    it('should generate a wrapper with open() and close() methods', async () => {
      const outputs = await generateDialogOutputs(
        'AddItemDialog',
        `
        import { Component, component, property } from '@apexdesigner/dsl/component';
        @component({ isDialog: true })
        export class AddItemDialogComponent extends Component {
          @property({ isInput: true })
          title!: string;
        }
      `
      );

      const wrapper = outputs.get('client/src/app/components/add-item-dialog/add-item-dialog.component.ts')!;

      expect(wrapper).toContain('export class AddItemDialogComponent');
      expect(wrapper).toContain('MatDialog');
      expect(wrapper).toContain('open()');
      expect(wrapper).toContain('close()');
    });

    it('should forward @Input properties to the dialog instance in open()', async () => {
      const outputs = await generateDialogOutputs(
        'AddItemDialog',
        `
        import { Component, component, property } from '@apexdesigner/dsl/component';
        @component({ isDialog: true })
        export class AddItemDialogComponent extends Component {
          @property({ isInput: true })
          title!: string;
        }
      `
      );

      const wrapper = outputs.get('client/src/app/components/add-item-dialog/add-item-dialog.component.ts')!;

      expect(wrapper).toContain('@Input()');
      expect(wrapper).toContain('title');
      expect(wrapper).toContain("instance['title'] = this._title");
    });

    it('should subscribe to @Output events from the dialog instance', async () => {
      const outputs = await generateDialogOutputs(
        'AddItemDialog',
        `
        import { Component, component, property } from '@apexdesigner/dsl/component';
        @component({ isDialog: true })
        export class AddItemDialogComponent extends Component {
          @property({ isOutput: true })
          saved!: void;
        }
      `
      );

      const wrapper = outputs.get('client/src/app/components/add-item-dialog/add-item-dialog.component.ts')!;

      expect(wrapper).toContain("instance['saved'].subscribe");
      expect(wrapper).toContain('this.saved.emit');
    });

    it('should rename the content component class with Content suffix', async () => {
      const outputs = await generateDialogOutputs(
        'AddItemDialog',
        `
        import { Component, component } from '@apexdesigner/dsl/component';
        @component({ isDialog: true })
        export class AddItemDialogComponent extends Component {}
      `
      );

      const content = outputs.get('client/src/app/components/add-item-dialog/add-item-dialog-content.component.ts')!;

      expect(content).toContain('export class AddItemDialogContentComponent');
      expect(content).toContain('MatDialogRef');
      expect(content).toContain('dialog: MatDialogRef<AddItemDialogContentComponent>');
    });

    it('should include options input with MatDialogConfig type on wrapper', async () => {
      const outputs = await generateDialogOutputs(
        'AddItemDialog',
        `
        import { Component, component } from '@apexdesigner/dsl/component';
        @component({ isDialog: true })
        export class AddItemDialogComponent extends Component {}
      `
      );

      const wrapper = outputs.get('client/src/app/components/add-item-dialog/add-item-dialog.component.ts')!;

      expect(wrapper).toContain('options');
      expect(wrapper).toContain('MatDialogConfig');
    });

    it('should preserve @angular/forms imports in dialog content component', async () => {
      const outputs = await generateDialogOutputs(
        'ClaimUserTaskDialog',
        `
        import { Component, component, property } from '@apexdesigner/dsl/component';
        import { EventEmitter } from '@angular/core';
        import { Validators } from '@angular/forms';
        @component({ isDialog: true })
        export class ClaimUserTaskDialogComponent extends Component {
          @property({ isOutput: true })
          claimed!: EventEmitter<any>;
        }
      `
      );

      const content = outputs.get('client/src/app/components/claim-user-task-dialog/claim-user-task-dialog-content.component.ts')!;

      expect(content).toContain("from '@angular/forms'");
      expect(content).toContain('Validators');
    });
  });

  describe('duplicate @angular/core imports', () => {
    it('should not produce duplicate EventEmitter import when design file also imports it', async () => {
      const ts = await generateComponent(`
        import { Component, component, property } from '@apexdesigner/dsl/component';
        import { EventEmitter } from '@angular/core';
        @component({})
        export class DashboardComponent extends Component {
          @property({ isOutput: true })
          claimed!: EventEmitter<any>;
        }
      `);

      const matches = ts.match(/EventEmitter/g) || [];
      // EventEmitter should appear in: import, type annotation, initializer — but NOT in a second import
      const importMatches = ts.match(/import\s*\{[^}]*EventEmitter[^}]*\}\s*from\s*['"]@angular\/core['"]/g) || [];
      expect(importMatches.length).toBe(1);
    });
  });

  describe('required and disabled form group options', () => {
    it('should pass required and disabled to form group constructor', async () => {
      const ts = await generateComponent(`
        import { Component, component, property } from '@apexdesigner/dsl/component';
        import { TaskFormGroup } from '@business-objects-client';
        @component({})
        export class DashboardComponent extends Component {
          @property({ required: ['userId'], disabled: ['name'] })
          task!: TaskFormGroup;
        }
      `);

      expect(ts).toContain("required: ['userId']");
      expect(ts).toContain("disabled: ['name']");
      expect(ts).toContain('new TaskFormGroup(');
    });

    it('should initialize with no options when neither required nor disabled specified', async () => {
      const ts = await generateComponent(`
        import { Component, component, property } from '@apexdesigner/dsl/component';
        import { TaskFormGroup } from '@business-objects-client';
        @component({})
        export class DashboardComponent extends Component {
          @property({})
          task!: TaskFormGroup;
        }
      `);

      expect(ts).toContain('new TaskFormGroup()');
    });
  });
});
