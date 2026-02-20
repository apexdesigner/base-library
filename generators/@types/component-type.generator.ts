import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassByBase, getDescription } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:componentType');

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

    lines.push(`export declare class ${metadata.name} {}`);

    const content = lines.join('\n');
    debug('Generated type file for %j', metadata.name);

    return content;
  }
};

export { componentTypeGenerator };
