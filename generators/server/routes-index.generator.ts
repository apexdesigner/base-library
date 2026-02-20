import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { kebabCase } from 'change-case';
import pluralize from 'pluralize';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:routesIndex');

const routesIndexGenerator: DesignGenerator = {
  name: 'routes-index',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    }
  ],

  outputs: () => [
    'server/src/routes/index.ts'
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);

    const businessObjects = context.listMetadata('BusinessObject');
    debug('found %d business objects', businessObjects.length);

    const lines: string[] = [];

    lines.push('import { Router } from "express";');

    // Import each route module
    for (const bo of businessObjects) {
      const pluralKebab = kebabCase(pluralize(bo.name));
      lines.push(`import ${pluralKebab}Router from "./${pluralKebab}.js";`);
    }

    lines.push('');
    lines.push('const router = Router();');
    lines.push('');

    // Mount each route
    for (const bo of businessObjects) {
      const pluralKebab = kebabCase(pluralize(bo.name));
      lines.push(`router.use("/${pluralKebab}", ${pluralKebab}Router);`);
    }

    lines.push('');
    lines.push('export default router;');

    const content = lines.join('\n');
    debug('Generated routes index with %d routes', businessObjects.length);

    return content;
  }
};

export { routesIndexGenerator };
