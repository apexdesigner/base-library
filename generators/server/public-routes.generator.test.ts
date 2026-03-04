import { describe, it, expect } from 'vitest';
import { publicRoutesGenerator } from './public-routes.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('publicRoutesGenerator', () => {
  it('should output to server/src/routes/public-routes.ts', () => {
    const outputs = publicRoutesGenerator.outputs({} as any);
    expect(outputs).toEqual(['server/src/routes/public-routes.ts']);
  });

  it('should collect app behavior with Everyone role and explicit path', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'AuthSpaConfig', {
      sourceCode: `
        import { addAppBehavior } from '@apexdesigner/dsl';
        import { Everyone } from '@roles';
        addAppBehavior(
          {
            type: "Class Behavior",
            httpMethod: "Get",
            path: "/api/auth/config",
            roles: [Everyone],
          },
          async function authSpaConfig() {}
        );
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await publicRoutesGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('"/api/auth/config"');
  });

  it('should use default path when no explicit path', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'HealthCheck', {
      sourceCode: `
        import { addAppBehavior } from '@apexdesigner/dsl';
        import { Everyone } from '@roles';
        addAppBehavior(
          {
            type: "Class Behavior",
            httpMethod: "Get",
            roles: [Everyone],
          },
          async function healthCheck() {}
        );
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await publicRoutesGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('"/api/health-check"');
  });

  it('should collect BO instance behavior with Everyone role', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'Document', {
      sourceCode: `
        import { BusinessObject } from '@apexdesigner/dsl';
        export class Document extends BusinessObject {
          title?: string;
        }
      `
    });
    workspace.addMetadata('Behavior', 'PublicView', {
      sourceCode: `
        import { addBehavior } from '@apexdesigner/dsl';
        import { Document } from '@business-objects';
        import { Everyone } from '@roles';
        addBehavior(
          Document,
          {
            type: "Instance",
            httpMethod: "Get",
            roles: [Everyone],
          },
          async function publicView(document: Document) {}
        );
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await publicRoutesGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('"/api/documents/:id/public-view"');
  });

  it('should collect BO class behavior with Everyone role', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'Document', {
      sourceCode: `
        import { BusinessObject } from '@apexdesigner/dsl';
        export class Document extends BusinessObject {
          title?: string;
        }
      `
    });
    workspace.addMetadata('Behavior', 'PublicList', {
      sourceCode: `
        import { addBehavior } from '@apexdesigner/dsl';
        import { Document } from '@business-objects';
        import { Everyone } from '@roles';
        addBehavior(
          Document,
          {
            type: "Class",
            httpMethod: "Get",
            roles: [Everyone],
          },
          async function publicList() {}
        );
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await publicRoutesGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('"/api/documents/public-list"');
  });

  it('should not include behavior without Everyone role', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'AdminOnly', {
      sourceCode: `
        import { addAppBehavior } from '@apexdesigner/dsl';
        import { Administrator } from '@roles';
        addAppBehavior(
          {
            type: "Class Behavior",
            httpMethod: "Get",
            roles: [Administrator],
          },
          async function adminOnly() {}
        );
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await publicRoutesGenerator.generate(metadata, workspace.context)) as string;

    expect(result).not.toContain('admin-only');
    expect(result).toContain('export const publicRoutes = [\n] as const;');
  });

  it('should not include behavior without httpMethod', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'SetupAuth', {
      sourceCode: `
        import { addAppBehavior } from '@apexdesigner/dsl';
        addAppBehavior(
          {
            type: "Lifecycle Behavior",
            stage: "Startup",
            sequence: 100,
          },
          async function setupAuth() {}
        );
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await publicRoutesGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('export const publicRoutes = [\n] as const;');
  });

  it('should sort routes alphabetically', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('AppBehavior', 'ZRoute', {
      sourceCode: `
        import { addAppBehavior } from '@apexdesigner/dsl';
        import { Everyone } from '@roles';
        addAppBehavior(
          {
            type: "Class Behavior",
            httpMethod: "Get",
            path: "/api/z-route",
            roles: [Everyone],
          },
          async function zRoute() {}
        );
      `
    });
    workspace.addMetadata('AppBehavior', 'ARoute', {
      sourceCode: `
        import { addAppBehavior } from '@apexdesigner/dsl';
        import { Everyone } from '@roles';
        addAppBehavior(
          {
            type: "Class Behavior",
            httpMethod: "Get",
            path: "/api/a-route",
            roles: [Everyone],
          },
          async function aRoute() {}
        );
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await publicRoutesGenerator.generate(metadata, workspace.context)) as string;

    const aIndex = result.indexOf('/api/a-route');
    const zIndex = result.indexOf('/api/z-route');
    expect(aIndex).toBeLessThan(zIndex);
  });

  it('should generate empty array when no public routes', async () => {
    const workspace = createSimpleMockWorkspace();

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await publicRoutesGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toBe('export const publicRoutes = [\n] as const;\n');
  });
});
