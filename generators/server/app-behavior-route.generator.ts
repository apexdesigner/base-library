import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:appBehaviorRoute');

const BEHAVIOR_HTTP_METHODS: Record<string, string> = {
  Post: 'post',
  Put: 'put',
  Patch: 'patch',
  Get: 'get',
  Delete: 'delete',
};

const appBehaviorRouteGenerator: DesignGenerator = {
  name: 'app-behavior-route',

  triggers: [
    {
      metadataType: 'AppBehavior',
    },
    {
      metadataType: 'Project',
    },
  ],

  outputs: () => ['server/src/routes/app-behaviors.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    // Collect app behaviors with httpMethod
    const appBehaviors = context.listMetadata('AppBehavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options && options.httpMethod && !options.lifecycleStage;
    });

    debug('qualifying app behaviors %j', appBehaviors.length);

    const outputs = new Map<string, string>();

    const lines: string[] = [];

    // Imports
    lines.push('import { Router, Request, Response, NextFunction } from "express";');
    if (appBehaviors.length > 0) {
      lines.push('import createDebug from "debug";');
      lines.push('import { App } from "../app.js";');
      lines.push('');
      lines.push(`const Debug = createDebug("${debugNamespace}:routes:appBehaviors");`);
    }
    lines.push('');
    lines.push('const router = Router();');

    for (const behavior of appBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        const httpMethod = BEHAVIOR_HTTP_METHODS[(options.httpMethod as string)] || 'post';

        // Determine route path: strip /api prefix, default to /<kebab-name>
        let routePath: string;
        if (options.path) {
          routePath = (options.path as string).replace(/^\/api/, '');
        } else {
          routePath = `/${kebabCase(func.name)}`;
        }

        const params = func.parameters || [];
        const hasParams = params.length > 0;
        const callArg = hasParams ? 'req.body' : '';

        lines.push('');
        lines.push(`// ${httpMethod.toUpperCase()} ${routePath} - ${func.name}`);
        lines.push(`router.${httpMethod}("${routePath}", async (req: Request, res: Response, next: NextFunction) => {`);
        lines.push(`  const debug = Debug.extend("${func.name}");`);
        if (hasParams) lines.push('  debug("req.body %j", req.body);');
        lines.push('');
        lines.push('  try {');
        lines.push(`    const result = await App.${func.name}(${callArg});`);
        lines.push('    debug("result %j", result);');
        lines.push('');
        lines.push('    res.json(result);');
        lines.push('  } catch (error) {');
        lines.push('    debug("error %j", error);');
        lines.push('');
        lines.push('    next(error);');
        lines.push('  }');
        lines.push('});');

        debug('added route %s %s for %j', httpMethod.toUpperCase(), routePath, func.name);
      } catch (err) {
        debug('error processing app behavior %j: %j', behavior.name, err);
      }
    }

    lines.push('');
    lines.push('export default router;');

    outputs.set('server/src/routes/app-behaviors.ts', lines.join('\n') + '\n');

    return outputs;
  }
};

export { appBehaviorRouteGenerator };
