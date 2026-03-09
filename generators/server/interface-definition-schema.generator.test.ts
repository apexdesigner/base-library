import { describe, it, expect } from 'vitest';
import { interfaceDefinitionSchemaGenerator } from './interface-definition-schema.generator.js';
import { createSimpleMockWorkspace } from '@apexdesigner/generator';

describe('interfaceDefinitionSchemaGenerator', () => {
  describe('basic types', () => {
    it('should map string, number, boolean to correct Zod types', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'Address', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class Address extends InterfaceDefinition {
            street?: string;
            zipCode?: number;
            isPrimary?: boolean;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('street: z.string()');
      expect(result).toContain('zipCode: z.number()');
      expect(result).toContain('isPrimary: z.boolean()');
    });

    it('should map Date to z.coerce.date()', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'Event', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class Event extends InterfaceDefinition {
            startDate?: Date;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('startDate: z.coerce.date()');
    });
  });

  describe('required vs optional', () => {
    it('should add .nullable().optional() for optional properties', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'Config', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class Config extends InterfaceDefinition {
            name?: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('name: z.string()\n      .nullable()\n      .optional()');
    });

    it('should not add .optional() for required properties with exclamation token', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'Config', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class Config extends InterfaceDefinition {
            name!: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('name: z.string()');
      expect(result).not.toContain('.optional()');
    });
  });

  describe('array properties', () => {
    it('should map string[] to z.array(z.string())', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'Config', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class Config extends InterfaceDefinition {
            scopes?: string[];
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('scopes: z.array(z.string())');
    });
  });

  describe('JSDoc descriptions', () => {
    it('should extract JSDoc comment for .describe()', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'Config', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class Config extends InterfaceDefinition {
            /** Issuer - OIDC issuer URL */
            issuer!: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('.describe("Issuer - OIDC issuer URL")');
    });

    it('should fall back to property name when no JSDoc', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'Config', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class Config extends InterfaceDefinition {
            issuer!: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('.describe("issuer")');
    });
  });

  describe('@property() decorator', () => {
    it('should apply required, hidden, disabled, displayName, presentAs', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'Form', {
        sourceCode: `
          import { InterfaceDefinition, property } from '@apexdesigner/dsl';
          export class Form extends InterfaceDefinition {
            @property({ required: true, displayName: "Full Name" })
            name?: string;

            @property({ hidden: true })
            secret?: string;

            @property({ disabled: true })
            readOnly?: string;

            @property({ presentAs: "textarea" })
            notes?: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('.requiredFinal()');
      expect(result).toContain('.displayName("Full Name")');
      expect(result).toContain('.hidden()');
      expect(result).toContain('.disabled()');
      expect(result).toContain('.presentAs("textarea")');
    });
  });

  describe('base type resolution', () => {
    it('should resolve base type to native Zod type', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'Email', {
        sourceCode: `
          import { BaseType } from '@apexdesigner/dsl';
          export class Email extends BaseType<string> {}
        `
      });
      workspace.addMetadata('InterfaceDefinition', 'ContactInfo', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          import { Email } from '@base-types';
          export class ContactInfo extends InterfaceDefinition {
            email?: Email;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('email: z.string()');
      expect(result).not.toContain('z.unknown()');
    });
  });

  describe('base type valid values', () => {
    it('should generate z.enum() for base type with valid values', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('BaseType', 'Status', {
        sourceCode: `
          import { BaseType, applyValidValues } from '@apexdesigner/dsl';
          export class Status extends BaseType<string> {}
          applyValidValues(Status, ["Active", "Inactive", "Pending"]);
        `
      });
      workspace.addMetadata('InterfaceDefinition', 'Filter', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          import { Status } from '@base-types';
          export class Filter extends InterfaceDefinition {
            status?: Status;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('z.enum(["Active", "Inactive", "Pending"])');
      expect(result).not.toContain('z.unknown()');
    });
  });

  describe('nested interface definitions', () => {
    it('should import and reference nested interface definition schema', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'GeoPoint', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class GeoPoint extends InterfaceDefinition {
            latitude?: number;
            longitude?: number;
          }
        `
      });
      workspace.addMetadata('InterfaceDefinition', 'Address', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          import { GeoPoint } from '@interface-definitions';
          export class Address extends InterfaceDefinition {
            street?: string;
            coordinates?: GeoPoint;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition').find(m => m.name === 'Address')!;
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { geoPoint } from "./geo-point.js"');
      expect(result).toContain('coordinates: geoPoint');
    });

    it('should handle array of nested interface definitions', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'PhoneNumber', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class PhoneNumber extends InterfaceDefinition {
            number?: string;
            type?: string;
          }
        `
      });
      workspace.addMetadata('InterfaceDefinition', 'ContactInfo', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          import { PhoneNumber } from '@interface-definitions';
          export class ContactInfo extends InterfaceDefinition {
            name?: string;
            phones?: PhoneNumber[];
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition').find(m => m.name === 'ContactInfo')!;
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('import { phoneNumber } from "./phone-number.js"');
      expect(result).toContain('phones: z.array(phoneNumber)');
    });
  });

  describe('class description', () => {
    it('should use class JSDoc for .describe() and class name for .as()', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'AuthConfig', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          /**
           * Auth Config
           *
           * OIDC authentication configuration.
           */
          export class AuthConfig extends InterfaceDefinition {
            issuer!: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('.describe("OIDC authentication configuration.")');
      expect(result).toContain('.as("AuthConfig")');
    });

    it('should export schema with both names', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'AuthConfig', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class AuthConfig extends InterfaceDefinition {
            issuer!: string;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).toContain('export const authConfig = z');
      expect(result).toContain('export { authConfig as authConfigSchema }');
    });
  });

  describe('no persistence concerns', () => {
    it('should not include column config or persistence imports', async () => {
      const workspace = createSimpleMockWorkspace();
      workspace.addMetadata('InterfaceDefinition', 'Config', {
        sourceCode: `
          import { InterfaceDefinition } from '@apexdesigner/dsl';
          export class Config extends InterfaceDefinition {
            name?: string;
            count?: number;
          }
        `
      });

      const metadata = workspace.context.listMetadata('InterfaceDefinition')[0];
      const result = (await interfaceDefinitionSchemaGenerator.generate(metadata, workspace.context)) as string;

      expect(result).not.toContain('schema-persistence');
      expect(result).not.toContain('.column(');
    });
  });
});
