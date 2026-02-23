import { describe, it, expect } from 'vitest';
import { pageComponentGenerator } from './page-component.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

async function generatePage(sourceCode: string): Promise<string> {
  const workspace = createSimpleMockWorkspace();
  workspace.addMetadata('Page', 'Home', { sourceCode });
  const metadata = workspace.context.listMetadata('Page')[0];
  const result = await pageComponentGenerator.generate(metadata, workspace.context) as Map<string, string>;
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
});
