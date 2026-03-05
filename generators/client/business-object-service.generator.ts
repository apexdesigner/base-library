import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:businessObjectService');

const businessObjectServiceGenerator: DesignGenerator = {
  name: 'business-object-service',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'BusinessObject',
    },
    {
      metadataType: 'Project',
    },
  ],

  outputs: () => [
    'client/src/app/services/business-object/business-object.service.ts',
    'design/@types/services/business-object.d.ts',
  ],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    // Collect all business objects, sorted by name
    const businessObjects = context.listMetadata('BusinessObject')
      .sort((a, b) => a.name.localeCompare(b.name));

    debug('found %d business objects', businessObjects.length);

    const entries = businessObjects.map(bo => {
      const className = pascalCase(bo.name);
      return {
        name: className,
        kebab: kebabCase(bo.name),
      };
    });

    // --- Runtime service ---
    const lines: string[] = [];

    lines.push("import { Injectable } from '@angular/core';");
    lines.push("import type { PersistedFormGroup } from '../../business-objects/persisted-form-group';");
    lines.push("import type { PersistedFormArray } from '../../business-objects/persisted-form-group';");
    lines.push("import type { PersistedArray } from '../../business-objects/persisted-form-group';");
    lines.push('import createDebug from "debug";');
    lines.push('');
    lines.push(`const debug = createDebug("${debugNamespace}:BusinessObjectService");`);
    lines.push('');

    // toKebab helper
    lines.push('function toKebab(name: string): string {');
    lines.push("  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();");
    lines.push('}');
    lines.push('');

    lines.push("@Injectable({ providedIn: 'root' })");
    lines.push('export class BusinessObjectService {');

    // names array
    const namesList = entries.map(e => `'${e.name}'`).join(', ');
    lines.push(`  readonly names = [${namesList}] as const;`);
    lines.push('');

    // loadFormGroup method
    lines.push('  async loadFormGroup(entityName: string, options?: any): Promise<PersistedFormGroup> {');
    lines.push('    debug("loadFormGroup %s", entityName);');
    lines.push('    const kebab = toKebab(entityName);');
    lines.push('    const m = await import(`../../business-objects/${kebab}-form-group`);');
    lines.push('    return new m[`${entityName}FormGroup`](options);');
    lines.push('  }');
    lines.push('');

    // loadFormArray method
    lines.push('  async loadFormArray(entityName: string, options?: any): Promise<PersistedFormArray> {');
    lines.push('    debug("loadFormArray %s", entityName);');
    lines.push('    const kebab = toKebab(entityName);');
    lines.push('    const m = await import(`../../business-objects/${kebab}-form-group`);');
    lines.push('    return new m[`${entityName}FormArray`](options);');
    lines.push('  }');
    lines.push('');

    // loadPersistedArray method
    lines.push('  async loadPersistedArray(entityName: string, options?: any): Promise<PersistedArray> {');
    lines.push('    debug("loadPersistedArray %s", entityName);');
    lines.push('    const kebab = toKebab(entityName);');
    lines.push('    const m = await import(`../../business-objects/${kebab}-form-group`);');
    lines.push('    return new m[`${entityName}PersistedArray`](options);');
    lines.push('  }');
    lines.push('');

    // loadEntity method
    lines.push('  async loadEntity(entityName: string): Promise<any> {');
    lines.push('    debug("loadEntity %s", entityName);');
    lines.push('    const kebab = toKebab(entityName);');
    lines.push('    const m = await import(`../../business-objects/${kebab}-form-group`);');
    lines.push('    return m[entityName];');
    lines.push('  }');

    lines.push('}');

    const serviceContent = lines.join('\n') + '\n';

    // --- Type declaration ---
    const typeLines: string[] = [];
    typeLines.push("import type { PersistedFormGroup } from '@business-objects-client';");
    typeLines.push("import type { PersistedFormArray } from '@business-objects-client';");
    typeLines.push("import type { PersistedArray } from '@business-objects-client';");
    typeLines.push('');
    typeLines.push('export declare class BusinessObjectService {');
    typeLines.push('  readonly names: readonly string[];');
    typeLines.push('  loadFormGroup(entityName: string, options?: any): Promise<PersistedFormGroup>;');
    typeLines.push('  loadFormArray(entityName: string, options?: any): Promise<PersistedFormArray>;');
    typeLines.push('  loadPersistedArray(entityName: string, options?: any): Promise<PersistedArray>;');
    typeLines.push('  loadEntity(entityName: string): Promise<any>;');
    typeLines.push('}');

    const typeContent = typeLines.join('\n') + '\n';

    debug('Generated business object service with %d business objects', entries.length);

    const outputs = new Map<string, string>();
    outputs.set('client/src/app/services/business-object/business-object.service.ts', serviceContent);
    outputs.set('design/@types/services/business-object.d.ts', typeContent);

    return outputs;
  },
};

export { businessObjectServiceGenerator };
