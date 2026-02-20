import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getDataSource } from '@apexdesigner/generator';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:routesIndex');

const routesIndexGenerator: DesignGenerator = {
  name: 'routes-index',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    },
    {
      metadataType: 'BusinessObject',
      condition: (metadata, conditionContext) => {
        if (isLibrary(metadata)) return false;
        if (!conditionContext?.context) return true;
        return !!getDataSource(metadata.sourceFile, conditionContext.context);
      },
    },
  ],

  outputs: () => ['server/src/routes/index.ts'],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const businessObjects = context.listMetadata('BusinessObject');
    const routeNames = businessObjects
      .filter(bo => !isLibrary(bo) && !!getDataSource(bo.sourceFile, context))
      .map(bo => kebabCase(bo.name))
      .sort();

    debug('routeNames %j', routeNames);

    if (routeNames.length === 0) {
      return '// No business objects yet\n';
    }

    const lines: string[] = [];

    lines.push('import { Router } from "express";');

    for (const name of routeNames) {
      lines.push(`import ${name.replace(/-/g, '_')}Router from "./${name}.js";`);
    }

    lines.push('');
    lines.push('const router = Router();');
    lines.push('');

    for (const name of routeNames) {
      lines.push(`router.use("/${name}", ${name.replace(/-/g, '_')}Router);`);
    }

    lines.push('');
    lines.push('export default router;');

    const content = lines.join('\n');
    debug('Generated routes index with %d routes', routeNames.length);

    return content;
  }
};

export { routesIndexGenerator };
