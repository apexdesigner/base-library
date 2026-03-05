import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassByBase, getDescription } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:mixinType');

const mixinTypeGenerator: DesignGenerator = {
  name: 'mixin-type',

  triggers: [
    {
      metadataType: 'Mixin',
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

    // Add exported interfaces (e.g. config interfaces)
    const configInterfaceName = `${className}Config`;
    let hasConfig = false;
    for (const iface of metadata.sourceFile.getInterfaces()) {
      if (!iface.isExported()) continue;
      const ifaceName = iface.getName();
      if (ifaceName === configInterfaceName) hasConfig = true;
      lines.push(`export interface ${ifaceName} {`);
      for (const prop of iface.getProperties()) {
        const propName = prop.getName();
        const isOptional = prop.hasQuestionToken();
        const typeNode = prop.getTypeNode();
        const propType = typeNode ? typeNode.getText() : 'any';
        lines.push(`  ${propName}${isOptional ? '?' : ''}: ${propType};`);
      }
      lines.push('}');
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
    if (hasConfig) {
      lines.push(`export declare function ${applyFunctionName}(target: any, options: ${configInterfaceName}): void;`);
    } else {
      lines.push(`export declare function ${applyFunctionName}(target: any): void;`);
    }

    const content = lines.join('\n');

    debug('Generated type file for %j', metadata.name);

    return content;
  }
};

export { mixinTypeGenerator };
