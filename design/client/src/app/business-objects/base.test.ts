import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('BusinessObjectBase', () => {
  const source = readFileSync(join(__dirname, 'base.ts'), 'utf8');

  it('should have an optional data parameter in constructor', () => {
    expect(source).toContain('constructor(data?: any)');
  });

  it('should guard Object.assign when data is undefined', () => {
    expect(source).toMatch(/if\s*\(data\)\s*Object\.assign/);
  });
});
