import { describe, it, expect } from 'vitest';
import { appServiceGenerator } from './app-service.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

function getOutput(result: Map<string, string>, path: string): string {
  return result.get(path)!;
}

const SERVICE_PATH = 'client/src/app/services/app/app.service.ts';
const TYPE_PATH = 'design/@types/services/app.d.ts';

function addProject(workspace: ReturnType<typeof createSimpleMockWorkspace>, name = 'TestProject') {
  workspace.addMetadata('Project', name, {
    sourceCode: `
      import { Project } from '@apexdesigner/dsl';
      export class ${name} extends Project {}
    `
  });
}

function addAppBehavior(workspace: ReturnType<typeof createSimpleMockWorkspace>, name: string, sourceCode: string) {
  workspace.addMetadata('AppBehavior', name, { sourceCode });
}

describe('appServiceGenerator', () => {
  describe('outputs', () => {
    it('should output service and type declaration', () => {
      const outputs = appServiceGenerator.outputs({} as any);
      expect(outputs).toEqual([SERVICE_PATH, TYPE_PATH]);
    });
  });

  describe('basic structure', () => {
    it('should generate an @Injectable service', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'systemHealthCheck',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';

        /** System Health Check */
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
          async function systemHealthCheck() { return { ok: true }; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("@Injectable({ providedIn: 'root' })");
      expect(ts).toContain('export class AppService');
    });

    it('should sort behaviors alphabetically', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'zebra',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior({ type: 'Class Behavior', httpMethod: 'Get', path: '/api/zebra' }, async function zebra() {});
      `
      );
      addAppBehavior(
        workspace,
        'alpha',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior({ type: 'Class Behavior', httpMethod: 'Get', path: '/api/alpha' }, async function alpha() {});
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const alphaIndex = ts.indexOf("name: 'alpha'");
      const zebraIndex = ts.indexOf("name: 'zebra'");
      expect(alphaIndex).toBeLessThan(zebraIndex);
    });
  });

  describe('class behavior', () => {
    it('should include httpMethod and path', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'healthCheck',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';

        /** Health Check - Returns server status */
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
          async function healthCheck() { return { ok: true }; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const section = ts.split("name: 'healthCheck'")[1]?.split('    },')[0] || '';
      expect(section).toContain("type: 'Class Behavior'");
      expect(section).toContain("httpMethod: 'Get'");
      expect(section).toContain("path: '/api/health'");
    });

    it('should include roles', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'adminReport',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        import { Administrator } from '@roles';

        /** Admin Report */
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/admin-report', roles: [Administrator] },
          async function adminReport() { return {}; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const section = ts.split("name: 'adminReport'")[1]?.split('    },')[0] || '';
      expect(section).toContain("roles: ['Administrator']");
    });

    it('should include metadata when present', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'adminReport',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';

        /** Admin Report */
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/admin-report', metadata: { category: 'reporting' } },
          async function adminReport() { return {}; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const section = ts.split("name: 'adminReport'")[1]?.split('    },')[0] || '';
      expect(section).toContain('"category":"reporting"');
    });

    it('should omit metadata when empty', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'healthCheck',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';

        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
          async function healthCheck() { return { ok: true }; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const section = ts.split("name: 'healthCheck'")[1]?.split('    },')[0] || '';
      expect(section).not.toContain('metadata:');
    });
  });

  describe('lifecycle behavior', () => {
    it('should include stage and sequence', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'setupAuth',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';

        /** Setup Auth - Initializes authentication */
        addAppBehavior(
          { type: 'Lifecycle Behavior', stage: 'Startup', sequence: 100 },
          async function setupAuth() {}
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const section = ts.split("name: 'setupAuth'")[1]?.split('    },')[0] || '';
      expect(section).toContain("type: 'Lifecycle Behavior'");
      expect(section).toContain("stage: 'Startup'");
      expect(section).toContain('sequence: 100');
    });

    it('should omit httpMethod and path for lifecycle behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'setupAuth',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';

        addAppBehavior(
          { type: 'Lifecycle Behavior', stage: 'Startup', sequence: 100 },
          async function setupAuth() {}
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const section = ts.split("name: 'setupAuth'")[1]?.split('    },')[0] || '';
      expect(section).not.toContain('httpMethod:');
      expect(section).not.toContain('path:');
    });
  });

  describe('JSDoc extraction', () => {
    it('should extract displayName and description from JSDoc', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'healthCheck',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';

        /**
         * Health Check
         *
         * Returns the current server health status.
         */
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
          async function healthCheck() { return { ok: true }; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("displayName: 'Health Check'");
      expect(ts).toContain("description: 'Returns the current server health status.'");
    });

    it('should default displayName to function name when no JSDoc', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'healthCheck',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
          async function healthCheck() { return { ok: true }; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain("displayName: 'healthCheck'");
    });
  });

  describe('guard behavior', () => {
    it('should include layer and stage for client guards', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'roleGuard',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';

        /** Role Guard - Checks role-based access */
        addAppBehavior(
          { type: 'Guard', stage: 'Activate', sequence: 100, layer: 'Client' },
          async function roleGuard() { return true; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      const section = ts.split("name: 'roleGuard'")[1]?.split('    },')[0] || '';
      expect(section).toContain("type: 'Guard'");
      expect(section).toContain("layer: 'Client'");
      expect(section).toContain("stage: 'Activate'");
      expect(section).toContain('sequence: 100');
    });
  });

  describe('type declaration', () => {
    it('should generate type declaration with interface and class', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'healthCheck',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
          async function healthCheck() { return { ok: true }; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = getOutput(result, TYPE_PATH);

      expect(dts).toContain('export interface AppBehaviorEntry');
      expect(dts).toContain('export declare class AppService');
      expect(dts).toContain('readonly behaviors: readonly AppBehaviorEntry[]');
      expect(dts).toContain('name: string');
      expect(dts).toContain('displayName: string');
      expect(dts).toContain('description: string');
      expect(dts).toContain('type: string');
      expect(dts).toContain("layer?: 'Client' | 'Server'");
      expect(dts).toContain('httpMethod?: string');
      expect(dts).toContain('path?: string');
      expect(dts).toContain('roles?: readonly string[]');
      expect(dts).toContain('stage?: string');
      expect(dts).toContain('sequence?: number');
      expect(dts).toContain('eventName?: string');
      expect(dts).toContain('metadata?: Record<string, unknown>');
    });
  });

  describe('HTTP call wrappers', () => {
    it('should generate a typed method for a GET class behavior', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'healthCheck',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
          async function healthCheck(): { ok: boolean } { return { ok: true }; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('async healthCheck()');
      expect(ts).toContain('this.http.get');
      expect(ts).toContain('/api/health');
    });

    it('should generate a typed method for a POST class behavior with body params', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'createReport',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Post', path: '/api/reports' },
          async function createReport(title: string, data: any): any { return {}; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('async createReport(title: string, data: any)');
      expect(ts).toContain('this.http.post');
    });

    it('should generate a typed method with path params', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'getCategory',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/categories/:categoryId/details' },
          async function getCategory(categoryId: number): any { return {}; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('async getCategory(categoryId: number)');
      expect(ts).toContain('${categoryId}');
    });

    it('should not generate methods for lifecycle or middleware behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'setupAuth',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Lifecycle Behavior', stage: 'Startup', sequence: 100 },
          async function setupAuth() {}
        );
      `
      );
      addAppBehavior(
        workspace,
        'authMiddleware',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Middleware', sequence: 100 },
          async function authMiddleware(req: any, res: any, next: () => void) {}
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).not.toContain('async setupAuth(');
      expect(ts).not.toContain('async authMiddleware(');
    });

    it('should include typed methods in the type declaration', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'healthCheck',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
          async function healthCheck(): { ok: boolean } { return { ok: true }; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = getOutput(result, TYPE_PATH);

      expect(dts).toContain('healthCheck(): Promise<{ ok: boolean }>');
    });

    it('should import HttpClient in generated service when class behaviors exist', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);
      addAppBehavior(
        workspace,
        'healthCheck',
        `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          { type: 'Class Behavior', httpMethod: 'Get', path: '/api/health' },
          async function healthCheck(): any { return {}; }
        );
      `
      );

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('HttpClient');
      expect(ts).toContain('inject(HttpClient)');
    });
  });

  describe('empty state', () => {
    it('should generate valid service with no app behaviors', async () => {
      const workspace = createSimpleMockWorkspace();
      addProject(workspace);

      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await appServiceGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const ts = getOutput(result, SERVICE_PATH);

      expect(ts).toContain('readonly behaviors: readonly AppBehaviorEntry[] = [');
      expect(ts).toContain('export class AppService');
    });
  });
});
