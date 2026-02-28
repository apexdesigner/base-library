import { describe, it, expect } from 'vitest';
import { persistedFormGroupGenerator } from './persisted-form-group.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('persistedFormGroupGenerator', () => {
  async function generateRuntime(): Promise<string> {
    const workspace = createSimpleMockWorkspace();
    const metadata = workspace.context.listMetadata('Project')[0];
    const result = (await persistedFormGroupGenerator.generate(metadata, workspace.context)) as Map<string, string>;
    return result.get('client/src/app/business-objects/persisted-form-group.ts')!;
  }

  describe('_populate method', () => {
    it('should generate a _populate method on PersistedFormGroup', async () => {
      const code = await generateRuntime();

      expect(code).toContain('_populate(data: Record<string, any>): void');
    });

    it('should lazily create controls for object keys in data', async () => {
      const code = await generateRuntime();

      // _populate should call createControl for unknown keys
      expect(code).toContain('const control = this.createControl(key)');
      expect(code).toContain('this.setControl(key, control)');
    });

    it('should recursively call _populate on nested PersistedFormGroup controls', async () => {
      const code = await generateRuntime();

      // The key fix: nested PersistedFormGroups should call _populate, not patchValue
      expect(code).toContain('control._populate(data[name])');
    });

    it('should call _populate from read() instead of inline logic', async () => {
      const code = await generateRuntime();

      // read() should delegate to _populate
      expect(code).toContain('this._populate(data)');

      // The old inline patchValue in nested form group block should NOT exist
      // (it was: control.patchValue(data[name]) inside a PersistedFormGroup instanceof check)
      // Instead, _populate handles it recursively
      const readMethod = code.split('async read(')[1]?.split('\n  }')[0] || '';
      expect(readMethod).not.toContain('control.patchValue(data[name])');
    });
  });

  describe('type declaration', () => {
    it('should include _populate in the .d.ts output', async () => {
      const workspace = createSimpleMockWorkspace();
      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await persistedFormGroupGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = result.get('design/@types/business-objects-client/persisted-form-group.d.ts')!;

      expect(dts).toContain('_populate(data: Record<string, any>): void');
    });
  });

  describe('required and disabled options', () => {
    it('should include required and disabled in PersistedFormGroupOptions', async () => {
      const code = await generateRuntime();

      expect(code).toContain('required?: string[]');
      expect(code).toContain('disabled?: string[]');
    });

    it('should apply Validators.required to required controls in constructor', async () => {
      const code = await generateRuntime();

      expect(code).toContain('Validators.required');
      expect(code).toContain('options?.required');
    });

    it('should disable controls specified in disabled option', async () => {
      const code = await generateRuntime();

      expect(code).toContain('.disable()');
      expect(code).toContain('options?.disabled');
    });

    it('should import Validators from @angular/forms', async () => {
      const code = await generateRuntime();

      expect(code).toContain("from '@angular/forms'");
      expect(code).toContain('Validators');
    });

    it('should include required and disabled in the type declaration', async () => {
      const workspace = createSimpleMockWorkspace();
      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await persistedFormGroupGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = result.get('design/@types/business-objects-client/persisted-form-group.d.ts')!;

      expect(dts).toContain('required?: string[]');
      expect(dts).toContain('disabled?: string[]');
    });
  });
});
