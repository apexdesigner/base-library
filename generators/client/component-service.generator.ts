import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:componentService');

/** Strip 'Component' suffix to get the base name */
function getBaseName(name: string): string {
  return name.replace(/Component$/, '');
}

const componentServiceGenerator: DesignGenerator = {
  name: 'component-service',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'Component',
    },
    {
      metadataType: 'Project',
    },
  ],

  outputs: () => [
    'client/src/app/services/component/component.service.ts',
    'design/@types/services/component.d.ts',
  ],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    // Collect all components, sorted by name, excluding AppComponent
    const components = context.listMetadata('Component')
      .filter(c => getBaseName(c.name) !== 'App')
      .sort((a, b) => a.name.localeCompare(b.name));

    debug('found %d components', components.length);

    const entries = components.map(c => {
      const baseName = getBaseName(c.name);
      const kebab = kebabCase(baseName);
      return {
        name: baseName,
        className: `${baseName}Component`,
        importPath: `../../components/${kebab}/${kebab}.component`,
      };
    });

    // --- Runtime service ---
    const lines: string[] = [];

    lines.push("import { Injectable } from '@angular/core';");
    lines.push("import type { Type } from '@angular/core';");
    lines.push('import createDebug from "debug";');
    lines.push('');
    lines.push(`const debug = createDebug("${debugNamespace}:ComponentService");`);
    lines.push('');
    lines.push("@Injectable({ providedIn: 'root' })");
    lines.push('export class ComponentService {');

    // names array
    const namesList = entries.map(e => `'${e.name}'`).join(', ');
    lines.push(`  readonly names = [${namesList}] as const;`);
    lines.push('');

    // loadComponent method
    lines.push('  async loadComponent(name: string): Promise<Type<any>> {');
    lines.push('    debug("loadComponent %s", name);');
    lines.push('    switch (name) {');
    for (const entry of entries) {
      lines.push(`      case '${entry.name}':`);
      lines.push(`        return import('${entry.importPath}').then(m => m.${entry.className});`);
    }
    lines.push('      default:');
    lines.push('        throw new Error(`Unknown component: ${name}`);');
    lines.push('    }');
    lines.push('  }');

    lines.push('}');

    const serviceContent = lines.join('\n') + '\n';

    // --- Type declaration ---
    const typeLines: string[] = [];
    typeLines.push("import type { Type } from '@angular/core';");
    typeLines.push('');
    typeLines.push('export declare class ComponentService {');
    typeLines.push('  readonly names: readonly string[];');
    typeLines.push('  loadComponent(name: string): Promise<Type<any>>;');
    typeLines.push('}');

    const typeContent = typeLines.join('\n') + '\n';

    debug('Generated component service with %d components', entries.length);

    const outputs = new Map<string, string>();
    outputs.set('client/src/app/services/component/component.service.ts', serviceContent);
    outputs.set('design/@types/services/component.d.ts', typeContent);

    return outputs;
  },
};

export { componentServiceGenerator };
