import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassByBase, getDescription } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:componentType');

const componentTypeGenerator: DesignGenerator = {
  name: 'component-type',

  triggers: [
    {
      metadataType: 'Component',
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `design/@types/components/${kebabCase(metadata.name)}.d.ts`
  ],

  async generate(metadata: DesignMetadata, _context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const lines: string[] = [];

    lines.push(`// Generated type definitions for ${metadata.name} component`);
    lines.push('');

    const componentClass = getClassByBase(metadata.sourceFile, 'Component');
    const description = componentClass ? getDescription(componentClass) : undefined;
    if (description) {
      lines.push(...description.split('\n').map(line => `// ${line}`));
      lines.push('');
    }

    // Check if component has isDialog option
    let isDialog = false;
    if (componentClass) {
      const componentDecorator = componentClass.getDecorator('component');
      if (componentDecorator) {
        const args = componentDecorator.getArguments();
        if (args.length > 0 && /isDialog:\s*true/.test(args[0].getText())) {
          isDialog = true;
        }
      }
    }

    if (isDialog) {
      lines.push(`export declare class ${metadata.name} {`);
      lines.push('  open(): void;');
      lines.push('  close(): void;');
      lines.push('}');
    } else {
      lines.push(`export declare class ${metadata.name} {}`);
    }

    const content = lines.join('\n');
    debug('Generated type file for %j', metadata.name);

    return content;
  }
};

export { componentTypeGenerator };
