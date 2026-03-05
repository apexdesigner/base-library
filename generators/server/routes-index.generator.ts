import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getDataSource } from '@apexdesigner/generator';
import { getBehaviorOptions } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import pluralize from 'pluralize';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:routesIndex');

const routesIndexGenerator: DesignGenerator = {
  name: 'routes-index',

  triggers: [
    {
      metadataType: 'Project',
    },
    {
      metadataType: 'BusinessObject',
      condition: (metadata, conditionContext) => {
        if (!conditionContext?.context) return true;
        return !!getDataSource(metadata.sourceFile, conditionContext.context);
      },
    },
    {
      metadataType: 'AppBehavior',
    },
  ],

  outputs: () => ['server/src/routes/index.ts'],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const businessObjects = context.listMetadata('BusinessObject');
    const routeNames = businessObjects
      .filter(bo => !!getDataSource(bo.sourceFile, context))
      .map(bo => kebabCase(pluralize(bo.name)))
      .sort();

    // Check for app behaviors with httpMethod
    const appBehaviors = context.listMetadata('AppBehavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options && options.httpMethod && !options.lifecycleStage;
    });
    const hasAppBehaviorRoutes = appBehaviors.length > 0;

    debug('routeNames %j', routeNames);
    debug('hasAppBehaviorRoutes %j', hasAppBehaviorRoutes);

    const lines: string[] = [];

    lines.push('import { Router } from "express";');

    if (hasAppBehaviorRoutes) {
      lines.push('import app_behaviorsRouter from "./app-behaviors.js";');
    }

    for (const name of routeNames) {
      lines.push(`import ${name.replace(/-/g, '_')}Router from "./${name}.js";`);
    }

    lines.push('');
    lines.push('const router = Router();');
    lines.push('');

    if (hasAppBehaviorRoutes) {
      lines.push('router.use("/", app_behaviorsRouter);');
    }

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
