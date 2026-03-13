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

  describe('service injection', () => {
    it('should inject services and add imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'PersonService', {
        sourceCode: `
          import { Service, service } from '@apexdesigner/dsl/service';
          @service()
          export class PersonService extends Service {}
        `
      });
      workspace.addMetadata('Component', 'Dashboard', {
        sourceCode: `
          import { Component, component } from '@apexdesigner/dsl/component';
          import { PersonService } from '@services';
          export class DashboardComponent extends Component {
            personService!: PersonService;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Component')[0];
      const result = (await componentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = result.get('client/src/app/components/dashboard/dashboard.component.ts')!;

      expect(ts).toContain('personService = inject(PersonService)');
      expect(ts).toContain("from '../../services/person/person.service'");
      expect(ts).toContain('inject');
    });

    it('should inject services from multiple separate @services imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'PersonService', {
        sourceCode: `
          import { Service, service } from '@apexdesigner/dsl/service';
          @service()
          export class PersonService extends Service {}
        `
      });
      // ComponentService is NOT a Service metadata — it is a generated service
      // only known via the @services import in the design file
      workspace.addMetadata('Component', 'Dashboard', {
        sourceCode: `
          import { Component, component } from '@apexdesigner/dsl/component';
          import { PersonService } from '@services';
          import { ComponentService } from '@services';
          export class DashboardComponent extends Component {
            personService!: PersonService;
            componentService!: ComponentService;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Component')[0];
      const result = (await componentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = result.get('client/src/app/components/dashboard/dashboard.component.ts')!;

      expect(ts).toContain('personService = inject(PersonService)');
      expect(ts).toContain('componentService = inject(ComponentService)');
      expect(ts).toContain("from '../../services/person/person.service'");
      expect(ts).toContain("from '../../services/component/component.service'");
    });
  });

  describe('injectLocally', () => {
    it('should add service to providers when injectLocally is true', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'PanelService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          export class PanelService extends Service {
            injectLocally = true;
          }
        `
      });
      workspace.addMetadata('Component', 'Dashboard', {
        sourceCode: `
          import { Component, component } from '@apexdesigner/dsl/component';
          import { PanelService } from '@services';
          export class DashboardComponent extends Component {
            panelService!: PanelService;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Component')[0];
      const result = (await componentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = result.get('client/src/app/components/dashboard/dashboard.component.ts')!;

      expect(ts).toContain('providers: [PanelService]');
      expect(ts).toContain('panelService = inject(PanelService)');
    });

    it('should not add providers when service does not use injectLocally', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Service', 'PersonService', {
        sourceCode: `
          import { Service } from '@apexdesigner/dsl/service';
          export class PersonService extends Service {}
        `
      });
      workspace.addMetadata('Component', 'Dashboard', {
        sourceCode: `
          import { Component, component } from '@apexdesigner/dsl/component';
          import { PersonService } from '@services';
          export class DashboardComponent extends Component {
            personService!: PersonService;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Component')[0];
      const result = (await componentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = result.get('client/src/app/components/dashboard/dashboard.component.ts')!;

      expect(ts).not.toContain('providers');
    });

    it('should add external type to providers when injectLocally is true', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('ExternalType', 'SomeClient', {
        sourceCode: `
          import { ExternalType, externalType } from '@apexdesigner/dsl/external-type';
          import { SomeClient } from 'some-library';
          @externalType({ injectable: true, injectLocally: true })
          export class SomeClientExternalType extends ExternalType {}
        `
      });
      workspace.addMetadata('Component', 'Dashboard', {
        sourceCode: `
          import { Component, component } from '@apexdesigner/dsl/component';
          import { SomeClient } from 'some-library';
          export class DashboardComponent extends Component {
            someClient!: SomeClient;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Component')[0];
      const result = (await componentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = result.get('client/src/app/components/dashboard/dashboard.component.ts')!;

      expect(ts).toContain('providers: [SomeClient]');
    });
  });

  describe('persisted array read options', () => {
    it('should pass all read options through to .read() call', async () => {
      const ts = await generateComponent(`
        import { Component, component, property } from '@apexdesigner/dsl/component';
        import { TaskPersistedArray } from '@business-objects-client';
        @component({})
        export class DashboardComponent extends Component {
          @property({ read: 'Automatically', where: { active: true }, include: { assignee: true }, order: { name: 'ASC' }, fields: ['id', 'name'], omit: ['description'], limit: 10, offset: 0 })
          tasks!: TaskPersistedArray;
        }
      `);

      expect(ts).toContain('await this.tasks.read(');
      expect(ts).toContain('where: { active: true }');
      expect(ts).toContain('include: { assignee: true }');
      expect(ts).toContain("order: { name: 'ASC' }");
      expect(ts).toContain("fields: ['id', 'name']");
      expect(ts).toContain("omit: ['description']");
      expect(ts).toContain('limit: 10');
      expect(ts).toContain('offset: 0');
    });

    it('should generate .read() with no args when no options specified', async () => {
      const ts = await generateComponent(`
        import { Component, component, property } from '@apexdesigner/dsl/component';
        import { TaskPersistedArray } from '@business-objects-client';
        @component({})
        export class DashboardComponent extends Component {
          @property({ read: 'Automatically' })
          tasks!: TaskPersistedArray;
        }
      `);

      expect(ts).toContain('await this.tasks.read()');
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

  describe('debounceMilliseconds', () => {
    it('should wrap the method body in a debounce timer', async () => {
      const ts = await generateComponent(`
        import { Component, component, method } from '@apexdesigner/dsl/component';
        @component({})
        export class DashboardComponent extends Component {
          @method({ debounceMilliseconds: 300 })
          async searchUsers(): Promise<void> {
            console.log('searching');
          }
        }
      `);

      expect(ts).toContain('_searchUsersTimeout');
      expect(ts).toContain('clearTimeout');
      expect(ts).toContain('setTimeout');
      expect(ts).toContain('300');
    });
  });

  describe('ViewChild with template refs', () => {
    it('should generate @ViewChild with read option for injectable external type matching a template ref', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('ExternalType', 'ViewContainerRef', {
        sourceCode: `
          import { externalType } from '@apexdesigner/dsl';
          import { ViewContainerRef } from '@angular/core';
          @externalType({ injectable: true })
          export class ViewContainerRefExternalType {}
        `
      });
      workspace.addMetadata('Component', 'Dashboard', {
        sourceCode: `
          import { Component, component, applyTemplate } from '@apexdesigner/dsl/component';
          import { ViewContainerRef } from '@angular/core';
          export class DashboardComponent extends Component {
            componentInsert!: ViewContainerRef;
          }

          applyTemplate(DashboardComponent, \`
            <ng-template #componentInsert></ng-template>
          \`);
        `
      });

      const metadata = workspace.context.listMetadata('Component')[0];
      const result = (await componentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = result.get('client/src/app/components/dashboard/dashboard.component.ts')!;

      expect(ts).toContain("@ViewChild('componentInsert', { read: ViewContainerRef })");
      expect(ts).not.toContain('inject(ViewContainerRef)');
    });
  });

  it('should apply @Input() to properties with both isInput and onChangeCall', async () => {
    const ts = await generateComponent(`
        import { Component, component, property } from '@apexdesigner/dsl/component';
        @component({})
        export class DashboardComponent extends Component {
          @property({ isInput: true, onChangeCall: 'loadDesign' })
          designUuid!: string;

          loadDesign() {}
        }
      `);

    // Should have @Input() on the setter
    expect(ts).toContain('@Input()');
    expect(ts).toContain('set designUuid');
    expect(ts).toContain('this.loadDesign()');
  });
});
