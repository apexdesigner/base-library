import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:appBehaviorRoute');

// Built-in roles that don't need missingRole checks
const IMPLICIT_ROLES = new Set(['Authenticated', 'Everyone']);

const BEHAVIOR_HTTP_METHODS: Record<string, string> = {
  Post: 'post',
  Put: 'put',
  Patch: 'patch',
  Get: 'get',
  Delete: 'delete'
};

const appBehaviorRouteGenerator: DesignGenerator = {
  name: 'app-behavior-route',

  triggers: [
    {
      metadataType: 'AppBehavior'
    },
    {
      metadataType: 'Project'
    }
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

    // Pre-compute role guards for each behavior to determine if missingRole import is needed
    interface RouteInfo {
      func: NonNullable<ReturnType<typeof getBehaviorFunction>>;
      httpMethod: string;
      routePath: string;
      hasParams: boolean;
      callArg: string;
      roleGuard: string[];
    }
    const routes: RouteInfo[] = [];

    for (const behavior of appBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        const httpMethod = BEHAVIOR_HTTP_METHODS[options.httpMethod as string] || 'post';

        let routePath: string;
        if (options.path) {
          routePath = (options.path as string).replace(/^\/api/, '');
        } else {
          routePath = `/${kebabCase(func.name)}`;
        }

        const params = func.parameters || [];
        const hasParams = params.length > 0;
        const callArg = hasParams ? 'req.body' : '';

        // Compute role guard
        const behaviorRoles = Array.isArray(options.roles) ? (options.roles as string[]) : [];
        const checkRoles = behaviorRoles.filter(r => !IMPLICIT_ROLES.has(r));
        const roleGuard = checkRoles.length > 0
          ? [`  if (missingRole(res, ${checkRoles.map(r => `"${r}"`).join(', ')})) return;`, '']
          : [];

        routes.push({ func, httpMethod, routePath, hasParams, callArg, roleGuard });
      } catch (err) {
        debug('error processing app behavior %j: %j', behavior.name, err);
      }
    }

    const needsMissingRole = routes.some(r => r.roleGuard.length > 0);

    const lines: string[] = [];

    // Imports
    lines.push('import { Router, Request, Response, NextFunction } from "express";');
    if (appBehaviors.length > 0) {
      lines.push('import createDebug from "debug";');
      lines.push('import { App } from "../app.js";');
    }
    if (needsMissingRole) {
      lines.push('import { missingRole } from "./missing-role.js";');
    }
    if (appBehaviors.length > 0) {
      lines.push('');
      lines.push(`const Debug = createDebug("${debugNamespace}:routes:appBehaviors");`);
    }
    lines.push('');
    lines.push('const router = Router();');

    for (const route of routes) {
      lines.push('');
      lines.push(`// ${route.httpMethod.toUpperCase()} ${route.routePath} - ${route.func.name}`);
      lines.push(`router.${route.httpMethod}("${route.routePath}", async (req: Request, res: Response, next: NextFunction) => {`);
      lines.push(`  const debug = Debug.extend("${route.func.name}");`);
      if (route.hasParams) lines.push('  debug("req.body %j", req.body);');
      lines.push('');
      for (const line of route.roleGuard) lines.push(line);
      lines.push('  try {');
      lines.push(`    const result = await App.${route.func.name}(${route.callArg});`);
      lines.push('    debug("result %j", result);');
      lines.push('');
      lines.push('    res.json(result);');
      lines.push('  } catch (error) {');
      lines.push('    debug("error %j", error);');
      lines.push('');
      lines.push('    next(error);');
      lines.push('  }');
      lines.push('});');

      debug('added route %s %s for %j', route.httpMethod.toUpperCase(), route.routePath, route.func.name);
    }

    lines.push('');
    lines.push('export default router;');

    outputs.set('server/src/routes/app-behaviors.ts', lines.join('\n') + '\n');

    return outputs;
  }
};

export { appBehaviorRouteGenerator };
