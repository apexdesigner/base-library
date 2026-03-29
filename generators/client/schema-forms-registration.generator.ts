import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassDecorator, getClassByBase } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:schemaFormsRegistration');

interface FieldRegistration {
  format: string;
  componentName: string;
  importPath: string;
  libraryOrder: number;
}

interface SectionRegistration {
  entityName: string;
  sectionKey: string;
  componentName: string;
  importPath: string;
  libraryOrder: number;
}

const schemaFormsRegistrationGenerator: DesignGenerator = {
  name: 'schema-forms-registration',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'Component',
    },
  ],

  outputs: () => ['client/src/app/schema-forms-registration.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext): Promise<Map<string, string>> {
    const debug = Debug.extend('generate');

    const allComponents = context.listMetadata('Component') || [];
    const fields: FieldRegistration[] = [];
    const sections: SectionRegistration[] = [];

    // Determine library order: libraries first (sorted by name), then main project last
    const projects = context.listMetadata('Project') || [];
    const libraryNames = projects.filter(p => isLibrary(p)).map(p => p.name).sort();
    const mainProject = projects.find(p => !isLibrary(p));

    function getLibraryOrder(sourceFile: any): number {
      const filePath = sourceFile.getFilePath?.() || '';
      for (let i = 0; i < libraryNames.length; i++) {
        if (filePath.includes(`node_modules/@apexdesigner/${kebabCase(libraryNames[i])}`)) {
          return i;
        }
      }
      // Main project comes last
      return libraryNames.length;
    }

    for (const comp of allComponents) {
      const compClass = getClassByBase(comp.sourceFile, 'Component');
      if (!compClass) continue;

      const opts = getClassDecorator(compClass, 'component');
      if (!opts) continue;

      const compBaseName = comp.name.replace(/Component$/, '');
      const compFile = kebabCase(compBaseName);
      const libraryOrder = getLibraryOrder(comp.sourceFile);

      if (opts.fieldFormat) {
        fields.push({
          format: opts.fieldFormat as string,
          componentName: comp.name,
          importPath: `@components/${compFile}/${compFile}.component`,
          libraryOrder,
        });
        debug('field %s → %s (order %d)', opts.fieldFormat, comp.name, libraryOrder);
      }

      if (opts.sectionEntity) {
        // sectionEntity is a class reference — extract the name
        const entityName = typeof opts.sectionEntity === 'string' ? opts.sectionEntity : (opts.sectionEntity as any).name || String(opts.sectionEntity);
        const sectionKey = `sf-${kebabCase(entityName)}-section`;
        sections.push({
          entityName,
          sectionKey,
          componentName: comp.name,
          importPath: `@components/${compFile}/${compFile}.component`,
          libraryOrder,
        });
        debug('section %s → %s (order %d)', sectionKey, comp.name, libraryOrder);
      }
    }

    // Sort by library order — libraries first, project last
    // Later entries override earlier ones (same format/section key)
    fields.sort((a, b) => a.libraryOrder - b.libraryOrder);
    sections.sort((a, b) => a.libraryOrder - b.libraryOrder);

    debug('total fields %d, sections %d', fields.length, sections.length);

    if (fields.length === 0 && sections.length === 0) {
      const empty = `// No schema-forms field or section registrations found\nexport function registerSchemaFormFields() {}\n`;
      const results = new Map<string, string>();
      results.set('client/src/app/schema-forms-registration.ts', empty);
      return results;
    }

    const lines: string[] = [];
    lines.push(`import { inject } from '@angular/core';`);
    lines.push(`import { SchemaFormsService } from '@apexdesigner/schema-forms';`);
    lines.push('');
    lines.push('export function registerSchemaFormFields(): void {');
    lines.push('  const schemaForms = inject(SchemaFormsService);');

    if (fields.length > 0) {
      lines.push('');
      lines.push('  // Field registrations (library order — later overrides earlier)');
      for (const field of fields) {
        lines.push(`  schemaForms.registerField('${field.format}', () => import('${field.importPath}').then(m => m.${field.componentName}));`);
      }
    }

    if (sections.length > 0) {
      lines.push('');
      lines.push('  // Section registrations (library order — later overrides earlier)');
      for (const section of sections) {
        lines.push(`  schemaForms.registerSection('${section.sectionKey}', () => import('${section.importPath}').then(m => m.${section.componentName} as any));`);
      }
    }

    lines.push('}');
    lines.push('');

    const results = new Map<string, string>();
    results.set('client/src/app/schema-forms-registration.ts', lines.join('\n'));

    debug('generated registration file');
    return results;
  },
};

export { schemaFormsRegistrationGenerator };
