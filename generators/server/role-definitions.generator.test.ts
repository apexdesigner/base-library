import { describe, it, expect } from 'vitest';
import { roleDefinitionsGenerator } from './role-definitions.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('roleDefinitionsGenerator', () => {
  it('should output to server/src/roles/role-definitions.ts', () => {
    const outputs = roleDefinitionsGenerator.outputs({} as any);
    expect(outputs).toEqual(['server/src/roles/role-definitions.ts']);
  });

  it('should generate role definitions from Role metadata', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Role', 'Administrator', {
      sourceCode: `
        import { Role } from '@apexdesigner/dsl';
        export class Administrator extends Role {}
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await roleDefinitionsGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('export const roleDefinitions = [');
    expect(result).toContain('name: "Administrator"');
    expect(result).toContain('displayName: "Administrator"');
    expect(result).toContain('] as const;');
  });

  it('should sort roles alphabetically', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Role', 'Manager', {
      sourceCode: `
        import { Role } from '@apexdesigner/dsl';
        export class Manager extends Role {}
      `
    });
    workspace.addMetadata('Role', 'Administrator', {
      sourceCode: `
        import { Role } from '@apexdesigner/dsl';
        export class Administrator extends Role {}
      `
    });
    workspace.addMetadata('Role', 'Viewer', {
      sourceCode: `
        import { Role } from '@apexdesigner/dsl';
        export class Viewer extends Role {}
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await roleDefinitionsGenerator.generate(metadata, workspace.context)) as string;

    const adminIndex = result.indexOf('Administrator');
    const managerIndex = result.indexOf('Manager');
    const viewerIndex = result.indexOf('Viewer');

    expect(adminIndex).toBeLessThan(managerIndex);
    expect(managerIndex).toBeLessThan(viewerIndex);
  });

  it('should generate empty array when no roles defined', async () => {
    const workspace = createSimpleMockWorkspace();

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await roleDefinitionsGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toBe('export const roleDefinitions = [\n] as const;\n');
  });

  it('should include name, displayName, and description from JSDoc', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Role', 'Administrator', {
      sourceCode: `
        import { Role } from '@apexdesigner/dsl';
        /**
         * Administrator
         *
         * Full access to all application features and configuration.
         */
        export class Administrator extends Role {}
      `
    });

    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await roleDefinitionsGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('name: "Administrator"');
    expect(result).toContain('displayName: "Administrator"');
    expect(result).toContain('description: "Full access to all application features and configuration."');
  });
});
