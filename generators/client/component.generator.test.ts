import { describe, it, expect } from 'vitest';
import { componentGenerator } from './component.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

async function generateComponent(sourceCode: string): Promise<string> {
  const workspace = createSimpleMockWorkspace();
  workspace.addMetadata('Component', 'Dashboard', { sourceCode });
  const metadata = workspace.context.listMetadata('Component')[0];
  const result = await componentGenerator.generate(metadata, workspace.context) as Map<string, string>;
  return result.get('client/src/app/components/dashboard/dashboard.component.ts')!;
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
});
