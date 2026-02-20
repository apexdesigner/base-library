import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassByBase, getDescription } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:pageType');

const pageTypeGenerator: DesignGenerator = {
  name: 'page-type',

  triggers: [
    {
      metadataType: 'Page',
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `design/@types/pages/${kebabCase(metadata.name)}.d.ts`
  ],

  async generate(metadata: DesignMetadata, _context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const lines: string[] = [];

    lines.push(`// Generated type definitions for ${metadata.name} page`);
    lines.push('');

    const pageClass = getClassByBase(metadata.sourceFile, 'Page');
    const description = pageClass ? getDescription(pageClass) : undefined;
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

export { pageTypeGenerator };
