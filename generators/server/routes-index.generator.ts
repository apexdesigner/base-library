import type { GeneratedFileGenerator } from '@apexdesigner/generator';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:routesIndex');

const routesIndexGenerator: GeneratedFileGenerator = {
  name: 'routes-index',

  isAggregate: true,

  triggers: [
    { metadataType: 'generated-file', glob: 'server/src/routes/*.ts' },
  ],

  outputs: () => [
    'server/src/routes/index.ts'
  ],

  async generate(filePaths: string[]) {
    const debug = Debug.extend('generate');
    debug('filePaths.length %j', filePaths.length);

    // Collect route module names, excluding the index itself
    const routeNames: string[] = [];
    for (const filePath of filePaths) {
      const filename = filePath.split('/').at(-1)!;
      const name = filename.replace(/\.ts$/, '');
      if (name !== 'index') {
        routeNames.push(name);
      }
    }
    routeNames.sort();

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
