import { describe, it, expect } from 'vitest';
import { pageComponentGenerator } from './page-component.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

async function generatePage(sourceCode: string): Promise<string> {
  const workspace = createSimpleMockWorkspace();
  workspace.addMetadata('Page', 'Home', { sourceCode });
  const metadata = workspace.context.listMetadata('Page')[0];
  const result = (await pageComponentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
  return result.get('client/src/app/pages/home/home.page.ts')!;
}

describe('pageComponentGenerator', () => {
  describe('callOnLoad', () => {
    it('should generate ngOnInit and call the method', async () => {
      const ts = await generatePage(`
        import { Page, page, method } from '@apexdesigner/dsl/page';
        @page({ path: '/' })
        export class HomePage extends Page {
          @method({ callOnLoad: true })
          loadData() {}
        }
      `);

      expect(ts).toContain('OnInit');
      expect(ts).toContain('ngOnInit()');
      expect(ts).toContain('this.loadData()');
    });
  });

  describe('callAfterLoad', () => {
    it('should generate ngAfterViewInit and call the method', async () => {
      const ts = await generatePage(`
        import { Page, page, method } from '@apexdesigner/dsl/page';
        @page({ path: '/' })
        export class HomePage extends Page {
          @method({ callAfterLoad: true })
          initChart() {}
        }
      `);

      expect(ts).toContain('AfterViewInit');
      expect(ts).toContain('ngAfterViewInit()');
      expect(ts).toContain('this.initChart()');
    });
  });

  describe('callOnUnload', () => {
    it('should generate ngOnDestroy and call the method', async () => {
      const ts = await generatePage(`
        import { Page, page, method } from '@apexdesigner/dsl/page';
        @page({ path: '/' })
        export class HomePage extends Page {
          @method({ callOnUnload: true })
          cleanup() {}
        }
      `);

      expect(ts).toContain('OnDestroy');
      expect(ts).toContain('ngOnDestroy()');
      expect(ts).toContain('this.cleanup()');
    });
  });

  describe('duplicate import prevention', () => {
    it('should not duplicate ActivatedRoute import when design file already imports from @angular/router', async () => {
      const ts = await generatePage(`
        import { Page, page, property } from '@apexdesigner/dsl/page';
        import { Router, ActivatedRoute } from '@angular/router';
        import { TestItemFormGroup } from '@business-objects-client';
        @page({ path: '/items/:item.id' })
        export class ItemPage extends Page {
          @property({ read: 'Automatically' })
          item!: TestItemFormGroup;
          router!: Router;
          activatedRoute!: ActivatedRoute;
        }
      `);

      // Should NOT have two separate import lines for @angular/router
      const routerImportLines = ts.split('\n').filter(line => line.includes('@angular/router') && line.includes('import'));
      expect(routerImportLines.length).toBe(1);
      // The single import should contain both Router and ActivatedRoute
      expect(routerImportLines[0]).toContain('Router');
      expect(routerImportLines[0]).toContain('ActivatedRoute');
    });

    it('should add ActivatedRoute import when no existing @angular/router import', async () => {
      const ts = await generatePage(`
        import { Page, page, property } from '@apexdesigner/dsl/page';
        import { TestItemFormGroup } from '@business-objects-client';
        @page({ path: '/items/:item.id' })
        export class ItemPage extends Page {
          @property({ read: 'Automatically' })
          item!: TestItemFormGroup;
        }
      `);

      // Should have ActivatedRoute in an import
      expect(ts).toContain('ActivatedRoute');
      expect(ts).toContain('@angular/router');
    });

    it('should merge ActivatedRoute into existing @angular/router import that has only Router', async () => {
      const ts = await generatePage(`
        import { Page, page, property } from '@apexdesigner/dsl/page';
        import { Router } from '@angular/router';
        import { TestItemFormGroup } from '@business-objects-client';
        @page({ path: '/items/:item.id' })
        export class ItemPage extends Page {
          @property({ read: 'Automatically' })
          item!: TestItemFormGroup;
          router!: Router;
        }
      `);

      // Should have a single @angular/router import with both Router and ActivatedRoute
      const routerImportLines = ts.split('\n').filter(line => line.includes('@angular/router') && line.includes('import'));
      expect(routerImportLines.length).toBe(1);
      expect(routerImportLines[0]).toContain('Router');
      expect(routerImportLines[0]).toContain('ActivatedRoute');
    });
  });

  describe('required and disabled form group options', () => {
    it('should pass required array to form group constructor', async () => {
      const ts = await generatePage(`
        import { Page, page, property } from '@apexdesigner/dsl/page';
        import { TaskFormGroup } from '@business-objects-client';
        @page({ path: '/tasks/:task.id' })
        export class TaskPage extends Page {
          @property({ read: 'Automatically', required: ['userId', 'userName'] })
          task!: TaskFormGroup;
        }
      `);

      expect(ts).toContain("required: ['userId', 'userName']");
      expect(ts).toContain('new TaskFormGroup(');
    });

    it('should pass disabled array to form group constructor', async () => {
      const ts = await generatePage(`
        import { Page, page, property } from '@apexdesigner/dsl/page';
        import { TaskFormGroup } from '@business-objects-client';
        @page({ path: '/tasks/:task.id' })
        export class TaskPage extends Page {
          @property({ read: 'Automatically', disabled: ['referenceNumber', 'name'] })
          task!: TaskFormGroup;
        }
      `);

      expect(ts).toContain("disabled: ['referenceNumber', 'name']");
      expect(ts).toContain('new TaskFormGroup(');
    });

    it('should pass both required and disabled to form group constructor', async () => {
      const ts = await generatePage(`
        import { Page, page, property } from '@apexdesigner/dsl/page';
        import { TaskFormGroup } from '@business-objects-client';
        @page({ path: '/tasks/:task.id' })
        export class TaskPage extends Page {
          @property({ read: 'Automatically', required: ['userId'], disabled: ['name'] })
          task!: TaskFormGroup;
        }
      `);

      expect(ts).toContain("required: ['userId']");
      expect(ts).toContain("disabled: ['name']");
      expect(ts).toContain('new TaskFormGroup(');
    });

    it('should initialize with no options when neither required nor disabled specified', async () => {
      const ts = await generatePage(`
        import { Page, page, property } from '@apexdesigner/dsl/page';
        import { TaskFormGroup } from '@business-objects-client';
        @page({ path: '/tasks/:task.id' })
        export class TaskPage extends Page {
          @property({ read: 'Automatically' })
          task!: TaskFormGroup;
        }
      `);

      expect(ts).toContain('new TaskFormGroup()');
    });
  });

  describe('afterReadCall', () => {
    it('should be implemented', () => {
      // TODO: Add test implementation
    });

    it('should set afterRead on the form group instead of inlining after read()', async () => {
      const ts = await generatePage(`
        import { Page, page, property } from '@apexdesigner/dsl/page';
        import { TestItemFormGroup } from '@business-objects-client';
        @page({ path: '/items/:item.id' })
        export class ItemPage extends Page {
          @property({ read: 'Automatically', afterReadCall: 'afterRead' })
          item!: TestItemFormGroup;

          afterRead() {}
        }
      `);

      // Should assign afterRead callback on the instance
      expect(ts).toContain('this.item.afterRead = () => this.afterRead()');
      // Should NOT inline the call after .read()
      const readCallLine = ts.split('\n').find(l => l.includes('await this.item.read('));
      const readCallIndex = ts.split('\n').indexOf(readCallLine!);
      const nextLine = ts.split('\n')[readCallIndex + 1] || '';
      expect(nextLine).not.toContain('this.afterRead()');
    });
  });

  describe('debounceMilliseconds', () => {
    it('should wrap the method body in a debounce timer', async () => {
      const ts = await generatePage(`
        import { Page, page, method } from '@apexdesigner/dsl/page';
        @page({ path: '/' })
        export class HomePage extends Page {
          @method({ debounceMilliseconds: 500 })
          async saveProfile(): Promise<void> {
            console.log('saving');
          }
        }
      `);

      expect(ts).toContain('_saveProfileTimeout');
      expect(ts).toContain('clearTimeout');
      expect(ts).toContain('setTimeout');
      expect(ts).toContain('500');
    });
  });

  describe('service injection', () => {
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
      workspace.addMetadata('Page', 'MyTask', {
        sourceCode: `
          import { Page, page } from '@apexdesigner/dsl/page';
          import { PersonService } from '@services';
          import { ComponentService } from '@services';
          @page({})
          export class MyTaskPage extends Page {
            personService!: PersonService;
            componentService!: ComponentService;
          }
        `
      });

      const metadata = workspace.context.listMetadata('Page')[0];
      const result = (await pageComponentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = result.get('client/src/app/pages/my-task/my-task.page.ts')!;

      expect(ts).toContain('personService = inject(PersonService)');
      expect(ts).toContain('componentService = inject(ComponentService)');
      expect(ts).toContain("from '../../services/person/person.service'");
      expect(ts).toContain("from '../../services/component/component.service'");
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
      workspace.addMetadata('Page', 'MyTask', {
        sourceCode: `
          import { Page, page, applyTemplate } from '@apexdesigner/dsl/page';
          import { ViewContainerRef } from '@angular/core';
          @page({})
          export class MyTaskPage extends Page {
            componentInsert!: ViewContainerRef;
          }

          applyTemplate(MyTaskPage, \`
            <ng-template #componentInsert></ng-template>
          \`);
        `
      });

      const metadata = workspace.context.listMetadata('Page')[0];
      const result = (await pageComponentGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = result.get('client/src/app/pages/my-task/my-task.page.ts')!;

      expect(ts).toContain("@ViewChild('componentInsert', { read: ViewContainerRef })");
      expect(ts).not.toContain('inject(ViewContainerRef)');
    });
  });
});
