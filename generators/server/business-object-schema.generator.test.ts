import { describe, it, expect } from 'vitest';
import { businessObjectSchemaGenerator } from './business-object-schema.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('businessObjectSchemaGenerator', () => {
  it('should pass through column config from id property decorator', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'User', {
      sourceCode: `
        import { BusinessObject, property } from '@apexdesigner/dsl';
        export class User extends BusinessObject {
          @property({ isId: true, column: { autoIncrement: true } })
          id!: number;
        }
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('.column({ autoIncrement: true })');
  });

  it('should pass through arbitrary column config from id property decorator', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'Order', {
      sourceCode: `
        import { BusinessObject, property } from '@apexdesigner/dsl';
        export class Order extends BusinessObject {
          @property({ isId: true, column: { type: 'BIGINT', autoIncrement: true } })
          id!: number;
        }
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('.column({ type: "BIGINT", autoIncrement: true })');
  });

  it('should pass through column config from regular property decorator', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'Product', {
      sourceCode: `
        import { BusinessObject, property } from '@apexdesigner/dsl';
        export class Product extends BusinessObject {
          @property({ column: { type: 'DECIMAL' } })
          price?: number;
        }
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as string;

    expect(result).toContain('.column({ type: "DECIMAL" })');
  });

  it('should not include column call when no column config in decorator', async () => {
    const workspace = createSimpleMockWorkspace();
    workspace.addMetadata('BusinessObject', 'Tag', {
      sourceCode: `
        import { BusinessObject, property } from '@apexdesigner/dsl';
        export class Tag extends BusinessObject {
          @property({ required: true })
          name?: string;
        }
      `,
    });

    const metadata = workspace.context.listMetadata('BusinessObject')[0];
    const result = (await businessObjectSchemaGenerator.generate(metadata, workspace.context)) as string;

    expect(result).not.toContain('.column(');
  });
});
