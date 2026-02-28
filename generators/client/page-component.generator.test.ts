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
});
