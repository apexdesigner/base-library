import { describe, it, expect } from 'vitest';
import { mixinTypeGenerator } from './mixin-type.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

async function generateMixinType(sourceCode: string): Promise<string> {
  const workspace = createSimpleMockWorkspace();
  workspace.addMetadata('Mixin', 'HistoryTracking', { sourceCode });
  const metadata = workspace.context.listMetadata('Mixin')[0];
  const result = await mixinTypeGenerator.generate(metadata, workspace.context);
  return result as string;
}

describe('mixinTypeGenerator', () => {
  it('should generate class and apply function for a simple mixin', async () => {
    const dts = await generateMixinType(`
      import { Mixin } from '@apexdesigner/dsl';
      export class HistoryTracking extends Mixin {}
    `);

    expect(dts).toContain('export declare class HistoryTracking {');
    expect(dts).toContain('export declare function applyHistoryTrackingMixin(target: any): void;');
  });

  it('should include exported config interface in the type declaration', async () => {
    const dts = await generateMixinType(`
      import { Mixin } from '@apexdesigner/dsl';
      export interface HistoryTrackingConfig {
        historyModel: any;
        foreignKey: string;
      }
      export class HistoryTracking extends Mixin {}
    `);

    expect(dts).toContain('export interface HistoryTrackingConfig {');
    expect(dts).toContain('  historyModel: any;');
    expect(dts).toContain('  foreignKey: string;');
  });

  it('should add config parameter to apply function when config interface exists', async () => {
    const dts = await generateMixinType(`
      import { Mixin } from '@apexdesigner/dsl';
      export interface HistoryTrackingConfig {
        historyModel: any;
        foreignKey: string;
      }
      export class HistoryTracking extends Mixin {}
    `);

    expect(dts).toContain(
      'export declare function applyHistoryTrackingMixin(target: any, options: HistoryTrackingConfig): void;'
    );
  });

  it('should not add config parameter when no config interface exists', async () => {
    const dts = await generateMixinType(`
      import { Mixin } from '@apexdesigner/dsl';
      export class HistoryTracking extends Mixin {}
    `);

    expect(dts).toContain('export declare function applyHistoryTrackingMixin(target: any): void;');
    expect(dts).not.toContain('options:');
  });
});
