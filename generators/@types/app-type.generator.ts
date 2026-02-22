import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { kebabCase, camelCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:appType');

const appTypeGenerator: DesignGenerator = {
  name: 'app-type',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['design/@types/app.d.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const dataSources = context.listMetadata('DataSource').filter(ds => !isLibrary(ds));
    const businessObjects = context.listMetadata('BusinessObject')
      .filter(bo => !isLibrary(bo))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Class app behaviors — those without a lifecycleStage
    const classBehaviors = context.listMetadata('AppBehavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options && !options.lifecycleStage;
    });

    const lines: string[] = [];

    // Imports for data sources
    for (const ds of dataSources) {
      lines.push(`import type { ${pascalCase(ds.name)} } from './data-sources/${kebabCase(ds.name)}';`);
    }

    // Imports for business objects
    for (const bo of businessObjects) {
      lines.push(`import type { ${pascalCase(bo.name)} } from './business-objects/${kebabCase(bo.name)}';`);
    }

    if (dataSources.length > 0 || businessObjects.length > 0) lines.push('');

    lines.push('export declare class App {');

    // dataSources
    if (dataSources.length > 0) {
      lines.push('  static dataSources: {');
      for (const ds of dataSources) {
        lines.push(`    ${camelCase(ds.name)}: ${pascalCase(ds.name)};`);
      }
      lines.push('  };');
    } else {
      lines.push('  static dataSources: Record<string, any>;');
    }

    lines.push('');

    // businessObjects
    if (businessObjects.length > 0) {
      lines.push('  static businessObjects: {');
      for (const bo of businessObjects) {
        lines.push(`    ${pascalCase(bo.name)}: typeof ${pascalCase(bo.name)};`);
      }
      lines.push('  };');
    } else {
      lines.push('  static businessObjects: Record<string, any>;');
    }

    lines.push('');

    // emit
    lines.push('  static emit(name: string, value: any): void;');

    // Class behavior static methods
    for (const behavior of classBehaviors) {
      try {
        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        const params = func.parameters || [];
        const paramStr = params
          .map(p => `${p.name}${p.isOptional ? '?' : ''}: ${p.type || 'any'}`)
          .join(', ');

        const returnType = func.returnType || 'Promise<any>';

        lines.push('');
        lines.push(`  static ${func.name}(${paramStr}): ${returnType};`);
      } catch (err) {
        debug('error processing behavior %j: %j', behavior.name, err);
      }
    }

    lines.push('}');

    const content = lines.join('\n') + '\n';
    debug('Generated app type file');

    return content;
  },
};

export { appTypeGenerator };
