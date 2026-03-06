import { describe, it, expect } from 'vitest';
import { functionTestGenerator } from './function-test.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('functionTestGenerator', () => {
  it('should generate test file from addTest calls', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Function', 'Has Role', {
      sourceCode: `
        import { addFunction, addTest } from '@apexdesigner/dsl';
        import { App } from '@app';
        import { hasRole } from '@functions';
        import { expect } from 'vitest';

        addFunction(
          { layer: 'Server' },
          function hasRole(roleName: string): boolean {
            return false;
          },
        );

        addTest('should return true when user has the role', async () => {
          expect(hasRole('Administrator')).toBe(true);
        });
      `
    });

    const metadata = workspace.context.listMetadata('Function')[0];
    const result = (await functionTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('import { describe, it, expect } from "vitest"');
    expect(result).toContain('import { hasRole } from "./has-role.js"');
    expect(result).toContain('import { App } from "../app.js"');
    expect(result).toContain('describe("hasRole"');
    expect(result).toContain('it("should return true when user has the role"');
    expect(result).toContain('async ()');
  });

  it('should carry external imports like node:async_hooks', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Function', 'Has Role', {
      sourceCode: `
        import { addFunction, addTest } from '@apexdesigner/dsl';
        import { App } from '@app';
        import { hasRole } from '@functions';
        import { AsyncLocalStorage } from 'node:async_hooks';
        import { expect } from 'vitest';

        addFunction(
          { layer: 'Server' },
          function hasRole(roleName: string): boolean {
            return false;
          },
        );

        addTest('should work with async local storage', async () => {
          const als = new AsyncLocalStorage();
          expect(als).toBeDefined();
        });
      `
    });

    const metadata = workspace.context.listMetadata('Function')[0];
    const result = (await functionTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('import { AsyncLocalStorage } from "node:async_hooks"');
  });

  it('should skip client-layer functions', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Function', 'Format Date', {
      sourceCode: `
        import { addFunction } from '@apexdesigner/dsl';

        addFunction(
          { layer: 'Client' },
          function formatDate(d: Date): string {
            return d.toISOString();
          },
        );
      `
    });

    const metadata = workspace.context.listMetadata('Function')[0];
    const outputs = functionTestGenerator.outputs(metadata);
    expect(outputs).toEqual([]);
  });

  it('should generate placeholder when no tests defined', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Function', 'Has Role', {
      sourceCode: `
        import { addFunction } from '@apexdesigner/dsl';

        addFunction(
          { layer: 'Server' },
          function hasRole(roleName: string): boolean {
            return false;
          },
        );
      `
    });

    const metadata = workspace.context.listMetadata('Function')[0];
    const result = (await functionTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('it.skip("no tests defined")');
  });

  it('should map @business-objects imports to relative paths', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Function', 'Check User', {
      sourceCode: `
        import { addFunction, addTest } from '@apexdesigner/dsl';
        import { User } from '@business-objects';
        import { checkUser } from '@functions';
        import { expect } from 'vitest';

        addFunction(
          { layer: 'Server' },
          function checkUser(): boolean {
            return false;
          },
        );

        addTest('should check user', async () => {
          expect(true).toBe(true);
        });
      `
    });

    const metadata = workspace.context.listMetadata('Function')[0];
    const result = (await functionTestGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('import { User } from "../business-objects/user.js"');
  });

  it('should output to server/src/functions/<name>.test.ts', () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('Function', 'Has Role', {
      sourceCode: `
        import { addFunction } from '@apexdesigner/dsl';

        addFunction(
          { layer: 'Server' },
          function hasRole(roleName: string): boolean {
            return false;
          },
        );
      `
    });

    const metadata = workspace.context.listMetadata('Function')[0];
    const outputs = functionTestGenerator.outputs(metadata);
    expect(outputs).toEqual(['server/src/functions/has-role.test.ts']);
  });
});
