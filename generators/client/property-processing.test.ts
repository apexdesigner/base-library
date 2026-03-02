import { describe, it, expect } from 'vitest';
import { buildReadArgs } from './property-processing.js';
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
      offset: '0',
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
      order: "{ name: 'ASC' }",
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
