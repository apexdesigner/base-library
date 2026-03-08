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

    it('should null out scalar controls not present in server data', async () => {
      const code = await generateRuntime();

      // When the API omits null fields, _populate must reset those controls
      expect(code).toContain('!(key in data)');
      expect(code).toContain('control.reset(null');
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

    it('should include entityName in the PersistedArray type declaration', async () => {
      const workspace = createSimpleMockWorkspace();
      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await persistedFormGroupGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = result.get('design/@types/business-objects-client/persisted-form-group.d.ts')!;

      // Both PersistedArray and PersistedFormArray should declare entityName
      const paSection = dts.split('export declare class PersistedArray')[1];
      expect(paSection).toContain('readonly entityName: string');
      const pfaSection = dts.split('export declare class PersistedFormArray')[1];
      expect(pfaSection).toContain('readonly entityName: string');
    });
  });

  describe('array item group creation', () => {
    it('should have a createItemGroup method on PersistedFormArray', async () => {
      const code = await generateRuntime();

      expect(code).toContain('createItemGroup(): any');
    });

    it('should have an addItem override that calls createItemGroup', async () => {
      const code = await generateRuntime();

      expect(code).toContain('override addItem(data?: any): void');
      expect(code).toContain('this.createItemGroup()');
    });

    it('should call _populate on the group when it is a PersistedFormGroup', async () => {
      const code = await generateRuntime();

      expect(code).toContain('group._populate(data)');
    });

    it('should fall back to super.addItem when createItemGroup returns undefined', async () => {
      const code = await generateRuntime();

      expect(code).toContain('super.addItem(data)');
    });

    it('should include createItemGroup and addItem in the type declaration', async () => {
      const workspace = createSimpleMockWorkspace();
      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await persistedFormGroupGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = result.get('design/@types/business-objects-client/persisted-form-group.d.ts')!;

      expect(dts).toContain('createItemGroup(): any');
      expect(dts).toContain('addItem(data?: any): void');
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

  describe('afterRead callback', () => {
    it('should be implemented', () => {
      // TODO: Add test implementation
    });

    it('should have an afterRead property on PersistedFormGroup', async () => {
      const code = await generateRuntime();

      expect(code).toContain('afterRead: (() => void) | null = null');
    });

    it('should call afterRead at the end of read()', async () => {
      const code = await generateRuntime();

      // afterRead should be called inside read(), after reading completes
      const readMethod = code.split('async read(')[1]?.split('\n  async ')[0] || '';
      expect(readMethod).toContain('this.afterRead');
    });

    it('should include afterRead in the type declaration', async () => {
      const workspace = createSimpleMockWorkspace();
      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await persistedFormGroupGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = result.get('design/@types/business-objects-client/persisted-form-group.d.ts')!;

      expect(dts).toContain('afterRead: (() => void) | null');
    });
  });

  describe('initial data option', () => {
    it('should include data in PersistedFormGroupOptions', async () => {
      const code = await generateRuntime();

      expect(code).toContain('data?: Record<string, any>');
    });

    it('should call _populate with initial data in constructor', async () => {
      const code = await generateRuntime();

      const constructor = code.split('constructor(')[1]?.split('\n  }')[0] || '';
      expect(constructor).toContain('options?.data');
      expect(constructor).toContain('this._populate(options.data)');
    });

    it('should include data in the type declaration options', async () => {
      const workspace = createSimpleMockWorkspace();
      const metadata = workspace.context.listMetadata('Project')[0];
      const result = (await persistedFormGroupGenerator.generate(metadata, workspace.context)) as Map<string, string>;
      const dts = result.get('design/@types/business-objects-client/persisted-form-group.d.ts')!;

      expect(dts).toContain('data?: Record<string, any>');
    });
  });

  describe('read() with non-id where clause', () => {
    it('should include find method on EntityClass interface', async () => {
      const code = await generateRuntime();

      // EntityClass (not EntityArrayClass) should have find()
      const entityClassSection = code.split('export interface EntityClass')[1]?.split('}')[0] || '';
      expect(entityClassSection).toContain('find(');
    });

    it('should use find() when where clause does not contain the id property', async () => {
      const code = await generateRuntime();

      // PersistedFormGroup.read() should fall back to find + first result when id is missing from where
      const readMethod = code.split('async read(')[1]?.split('\n  protected ')[0] || '';
      expect(readMethod).toContain('this._entityClass.find(');
    });

    it('should still use findById() when where clause contains the id property', async () => {
      const code = await generateRuntime();

      const readMethod = code.split('async read(')[1]?.split('\n  protected ')[0] || '';
      expect(readMethod).toContain('this._entityClass.findById(');
    });
  });

  it('should include entityName property on PersistedArray', async () => {
    const code = await generateRuntime();
    expect(code).toContain('readonly entityName: string');
  });

  it('should include entityName property on PersistedFormArray', async () => {
    const code = await generateRuntime();
    // PersistedFormArray should also have entityName
    const formArraySection = code.split('export class PersistedFormArray')[1];
    expect(formArraySection).toContain('readonly entityName: string');
  });
});
