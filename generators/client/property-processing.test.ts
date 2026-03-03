import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { buildReadArgs, addBoImports } from './property-processing.js';
import type { PersistedArrayProperty } from './property-processing.js';

describe('buildReadArgs', () => {
  it('should return empty string when no options are set', () => {
    const pa: PersistedArrayProperty = { name: 'items', typeName: 'ItemPersistedArray' };
    expect(buildReadArgs(pa)).toBe('');
  });

  it('should include all provided options', () => {
    const pa: PersistedArrayProperty = {
      name: 'tasks',
      typeName: 'TaskPersistedArray',
      where: '{ active: true }',
      include: '{ assignee: true }',
      order: "{ name: 'ASC' }",
      fields: "['id', 'name']",
      omit: "['description']",
      limit: '10',
      offset: '0'
    };
    const result = buildReadArgs(pa);
    expect(result).toContain('where: { active: true }');
    expect(result).toContain('include: { assignee: true }');
    expect(result).toContain("order: { name: 'ASC' }");
    expect(result).toContain("fields: ['id', 'name']");
    expect(result).toContain("omit: ['description']");
    expect(result).toContain('limit: 10');
    expect(result).toContain('offset: 0');
  });

  it('should only include options that are set', () => {
    const pa: PersistedArrayProperty = {
      name: 'tasks',
      typeName: 'TaskPersistedArray',
      where: '{ active: true }',
      order: "{ name: 'ASC' }"
    };
    const result = buildReadArgs(pa);
    expect(result).toContain('where: { active: true }');
    expect(result).toContain("order: { name: 'ASC' }");
    expect(result).not.toContain('include:');
    expect(result).not.toContain('fields:');
    expect(result).not.toContain('omit:');
    expect(result).not.toContain('limit:');
    expect(result).not.toContain('offset:');
  });

});

describe('addBoImports', () => {
  function getImports(boNames: string[]): string[] {
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile('test.ts', '');
    addBoImports(file, new Set(boNames), '../../business-objects');
    return file.getImportDeclarations().map(d => d.getModuleSpecifierValue());
  }

  it('should import PersistedArray from persisted-form-group, not persisted-array', () => {
    const paths = getImports(['PersistedArray']);
    expect(paths).toEqual(['../../business-objects/persisted-form-group']);
  });

  it('should group all persisted base types into a single import', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile('test.ts', '');
    addBoImports(file, new Set(['PersistedFormGroup', 'PersistedArray', 'PersistedFormArray']), '../../business-objects');
    const imports = file.getImportDeclarations();
    expect(imports.length).toBe(1);
    expect(imports[0].getModuleSpecifierValue()).toBe('../../business-objects/persisted-form-group');
    const names = imports[0].getNamedImports().map(n => n.getName()).sort();
    expect(names).toEqual(['PersistedArray', 'PersistedFormArray', 'PersistedFormGroup']);
  });

  it('should use kebab-case paths for non-base BO types', () => {
    const paths = getImports(['TestCategoryFormGroup']);
    expect(paths).toEqual(['../../business-objects/test-category-form-group']);
  });

  it('should import PersistedArray subtypes from their form-group file', () => {
    const paths = getImports(['TestItemPersistedArray']);
    expect(paths).toEqual(['../../business-objects/test-item-form-group']);
  });

  it('should group FormGroup and PersistedArray of same BO into one import', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile('test.ts', '');
    addBoImports(file, new Set(['TestCategoryFormGroup', 'TestCategoryPersistedArray']), '../../business-objects');
    const imports = file.getImportDeclarations();
    expect(imports.length).toBe(1);
    expect(imports[0].getModuleSpecifierValue()).toBe('../../business-objects/test-category-form-group');
    const names = imports[0].getNamedImports().map(n => n.getName()).sort();
    expect(names).toEqual(['TestCategoryFormGroup', 'TestCategoryPersistedArray']);
  });
});
