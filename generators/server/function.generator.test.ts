import { describe, it, expect } from 'vitest';
import { serverFunctionGenerator } from './function.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('serverFunctionGenerator', () => {
  describe('self-referencing @functions import', () => {
    it('should not import the function name that is being declared in the same file', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Function', 'CurrentUser', {
        sourceCode: `
          import { addFunction } from '@apexdesigner/dsl';
          import { currentUser } from '@functions';
          import { expect } from 'vitest';

          addFunction({ layer: 'Server' }, function currentUser() {
            return { id: 1 };
          });
        `
      });

      const metadata = workspace.context.listMetadata('Function')[0];
      const result = (await serverFunctionGenerator.generate(metadata, workspace.context)) as string;

      // Should export the function
      expect(result).toContain('export function currentUser()');

      // Should NOT import itself — that would conflict with the local declaration
      expect(result).not.toContain('import { currentUser }');
    });

    it('should still import other functions from @functions', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('Function', 'HasRole', {
        sourceCode: `
          import { addFunction } from '@apexdesigner/dsl';
          import { hasRole, currentUser } from '@functions';
          import { expect } from 'vitest';

          addFunction({ layer: 'Server' }, function hasRole(roleName: string): boolean {
            const user = currentUser();
            return !!user;
          });
        `
      });

      const metadata = workspace.context.listMetadata('Function')[0];
      const result = (await serverFunctionGenerator.generate(metadata, workspace.context)) as string;

      // Should export the function
      expect(result).toContain('export function hasRole(');

      // Should NOT import itself
      expect(result).not.toContain('import { hasRole }');

      // Should still import other functions
      expect(result).toContain('import { currentUser }');
    });
  });
});
