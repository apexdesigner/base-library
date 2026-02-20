import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassByBase, getDescription } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:mixinType');

const mixinTypeGenerator: DesignGenerator = {
  name: 'mixin-type',

  triggers: [
    {
      metadataType: 'Mixin',
      condition: (metadata) => !isLibrary(metadata),
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `design/@types/mixins/${kebabCase(metadata.name)}.d.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const className = pascalCase(metadata.name);
    const applyFunctionName = `apply${className}Mixin`;

    const lines: string[] = [];

    lines.push(`// Generated type definitions for ${metadata.name} mixin`);
    lines.push('');

    const mixinClass = getClassByBase(metadata.sourceFile, 'Mixin');
    const description = mixinClass ? getDescription(mixinClass) : undefined;
    if (description) {
      lines.push(...description.split('\n').map(line => `// ${line}`));
      lines.push('');
    }

    lines.push(`export declare class ${className} {`);

    // Add properties
    if (mixinClass) {
      for (const prop of mixinClass.getProperties()) {
        const propName = prop.getName();
        const isOptional = prop.hasQuestionToken();
        let propType = prop.getType().getText();
        propType = propType.replace(' | undefined', '');

        lines.push(`  ${propName}${isOptional ? '?' : ''}: ${propType};`);
      }
    }

    lines.push('}');
    lines.push('');

    // Add apply function declaration
    lines.push(`export declare function ${applyFunctionName}(target: any): void;`);

    const content = lines.join('\n');

    debug('Generated type file for %j', metadata.name);

    return content;
  }
};

export { mixinTypeGenerator };
