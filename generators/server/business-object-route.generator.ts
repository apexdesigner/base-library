import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getDataSource, resolveIdType, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import {
  getClassByBase,
  getDescription,
  getBehaviorFunction,
  getBehaviorOptions,
  getBehaviorParent,
  getModuleLevelCall
} from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import pluralize from 'pluralize';
import createDebug from 'debug';
import { classifyBehaviorParams } from '../shared/classify-params.js';

const Debug = createDebug('BaseLibrary:generators:businessObjectRoute');

// Lifecycle behavior types to exclude from routes
const LIFECYCLE_TYPES = new Set([
  'Before Create',
  'After Create',
  'Before Update',
  'After Update',
  'Before Delete',
  'After Delete',
  'Before Read',
  'After Read',
  'After Start'
]);

// HTTP methods for behaviors
const BEHAVIOR_HTTP_METHODS: Record<string, string> = {
  Post: 'post',
  Put: 'put',
  Patch: 'patch',
  Get: 'get',
  Delete: 'delete'
};

// Built-in roles that don't need hasRole checks
const IMPLICIT_ROLES = new Set(['Authenticated', 'Everyone']);

/**
 * Extract role names from applyDefaultRoles(BO, [Role1, Role2]).
 */
function getDefaultRoleNames(sourceFile: DesignMetadata['sourceFile']): string[] {
  const call = getModuleLevelCall(sourceFile, 'applyDefaultRoles');
  if (!call) return [];

  const args = call.getArguments();
  if (args.length < 2) return [];

  const rolesArg = args[1];
  if (!Node.isArrayLiteralExpression(rolesArg)) return [];

  return rolesArg
    .getElements()
    .filter(el => Node.isIdentifier(el))
    .map(el => el.getText());
}

/**
 * Emit missingRole guard lines for the given role names.
 * Returns empty array if no guard is needed (no roles, or all roles are implicit).
 */
function emitRoleGuard(roleNames: string[]): string[] {
  const checkRoles = roleNames.filter(r => !IMPLICIT_ROLES.has(r));
  if (checkRoles.length === 0) return [];

  const args = checkRoles.map(r => `"${r}"`).join(', ');
  return [`  if (missingRole(res, ${args})) return;`, ''];
}

const businessObjectRouteGenerator: DesignGenerator = {
  name: 'business-object-route',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata, conditionContext) => {
        if (!conditionContext?.context) return true;
        return !!getDataSource(metadata.sourceFile, conditionContext.context);
      }
    },
    {
      metadataType: 'Behavior',
      condition: (metadata, conditionContext) => {
        const parentName = getBehaviorParent(metadata.sourceFile);
        if (!parentName) return false;
        if (!conditionContext?.context) return true;
        const boMeta = conditionContext.context.listMetadata('BusinessObject').find(bo => pascalCase(bo.name) === parentName);
        return !!boMeta;
      }
    }
  ],

  outputs: (metadata: DesignMetadata) => {
    const name = getBehaviorParent(metadata.sourceFile) || metadata.name;
    return [`server/src/routes/${kebabCase(pluralize(name))}.ts`];
  },

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // If triggered by a Behavior, resolve to the parent BO metadata
    const parentName = getBehaviorParent(metadata.sourceFile);
    if (parentName) {
      const boMeta = context.listMetadata('BusinessObject').find(bo => pascalCase(bo.name) === parentName);
      if (boMeta) {
        debug('resolved behavior %j to parent BO %j', metadata.name, boMeta.name);
        metadata = boMeta;
      }
    }

    debug('START generate for %j', metadata.name);

    const className = pascalCase(metadata.name);
    const varName = camelCase(metadata.name);
    const schemaVarName = camelCase(metadata.name);
    const pluralKebab = kebabCase(pluralize(metadata.name));
    const entityLabel = metadata.name;

    const isView = !!getModuleLevelCall(metadata.sourceFile, 'setView');
    debug('className %j, pluralKebab %j, isView %j', className, pluralKebab, isView);

    // Get id property info — resolve to a primitive TS type
    const resolvedId = resolveIdType(metadata.sourceFile, context);
    const idName = resolvedId.name;
    let idType = resolvedId.type;
    if (idType !== 'string' && idType !== 'number') {
      idType = idType.includes('import(') || /^[A-Z]/.test(idType) ? 'string' : idType;
    }
    const idCoerce = idType === 'number' ? 'Number(req.params.id)' : 'String(req.params.id)';

    // Extract default roles from applyDefaultRoles(BO, [Role1, Role2])
    const defaultRoles = getDefaultRoleNames(metadata.sourceFile);
    const defaultRoleGuard = emitRoleGuard(defaultRoles);
    debug('defaultRoles %j', defaultRoles);

    // Collect behavior routes before emitting code so we know all role requirements upfront
    const mixins = resolveMixins(metadata.sourceFile, context);
    const parentNames = new Set([className, ...mixins.map(m => m.name)]);
    const allBehaviors = context.listMetadata('Behavior');
    debug('total behaviors in project %j', allBehaviors.length);

    interface BehaviorRoute {
      func: NonNullable<ReturnType<typeof getBehaviorFunction>>;
      httpMethod: string;
      behaviorKebab: string;
      /** Custom route path from options.path (stripped of /api prefix), or undefined for default */
      customRoutePath?: string;
      hasParams: boolean;
      callArg: string;
      roleGuard: string[];
    }
    const classBehaviorRoutes: BehaviorRoute[] = [];
    const instanceBehaviorRoutes: BehaviorRoute[] = [];

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const parent = getBehaviorParent(behavior.sourceFile);
        if (!parent || !parentNames.has(parent)) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        // Skip lifecycle behaviors
        if (LIFECYCLE_TYPES.has(options.type as string)) continue;

        const isInstance = options.type === 'Instance';
        const httpMethod = BEHAVIOR_HTTP_METHODS[(options.httpMethod as string) || 'Post'] || 'post';
        const behaviorKebab = kebabCase(func.name);

        const params = func.parameters || [];
        const methodParams = isInstance ? params.slice(1) : params;
        const hasParams = methodParams.length > 0;

        // Classify params by source: path (from URL), header, body
        const routePath = options.path as string | undefined;
        const classified = classifyBehaviorParams(methodParams, routePath);

        // Single object/any body param: pass req.body directly (it IS the param)
        const OBJECT_TYPES = new Set(['any', 'object', 'Record']);
        const bodyIsPassthrough =
          classified.body.length === 1 &&
          (OBJECT_TYPES.has(classified.body[0].type || 'any') || (classified.body[0].type || '').startsWith('{'));

        const callArg = !hasParams
          ? ''
          : methodParams
              .map(p => {
                const cp = classified.all.find(c => c.name === p.name)!;
                if (cp.source === 'path') return `req.params.${p.name}`;
                if (cp.source === 'header') return `req.headers["${cp.headerName}"]`;
                if (bodyIsPassthrough && classified.body.length === 1) return 'req.body';
                return `req.body.${p.name}`;
              })
              .join(', ');

        // Behavior-level roles override default roles
        const behaviorRoles = Array.isArray(options.roles) ? (options.roles as string[]) : [];
        const roleGuard = behaviorRoles.length > 0 ? emitRoleGuard(behaviorRoles) : defaultRoleGuard;

        // Compute custom route path: strip /api and the BO plural prefix
        let customRoutePath: string | undefined;
        if (routePath) {
          let stripped = routePath.replace(/^\/api/, '');
          const boPrefix = `/${pluralKebab}`;
          if (stripped.startsWith(boPrefix)) {
            stripped = stripped.slice(boPrefix.length);
          }
          customRoutePath = stripped || undefined;
        }

        const route: BehaviorRoute = { func, httpMethod, behaviorKebab, customRoutePath, hasParams, callArg, roleGuard };

        if (isInstance) {
          instanceBehaviorRoutes.push(route);
        } else {
          classBehaviorRoutes.push(route);
        }

        debug('found route for behavior %j (instance: %j, method: %j)', func.name, isInstance, httpMethod);
      } catch (err) {
        debug('error processing behavior %j: %j', behavior.name, err);
      }
    }

    // Sort behaviors alphabetically for deterministic output
    classBehaviorRoutes.sort((a, b) => a.func.name.localeCompare(b.func.name));
    instanceBehaviorRoutes.sort((a, b) => a.func.name.localeCompare(b.func.name));

    // Determine if hasRole import is needed
    const allBehaviorRoutes = [...classBehaviorRoutes, ...instanceBehaviorRoutes];
    const needsHasRole = defaultRoleGuard.length > 0 || allBehaviorRoutes.some(r => r.roleGuard.length > 0);

    const lines: string[] = [];

    // Imports
    lines.push(`import createDebug from "debug";`);
    lines.push(`import { Router, Request, Response, NextFunction } from "express";`);
    if (!isView) {
      lines.push(`import { z } from "zod";`);
    }
    lines.push(`import { ${className} } from "../business-objects/${kebabCase(metadata.name)}.js";`);
    if (!isView) {
      lines.push(`import { ${schemaVarName}Schema } from "../schemas/business-objects/${kebabCase(metadata.name)}.js";`);
    }
    if (needsHasRole) {
      lines.push('import { missingRole } from "./missing-role.js";');
    }
    lines.push('import { parseFilter } from "./parse-filter.js";');
    lines.push('');

    // Debug and router setup
    const debugNamespace = pascalCase((context.listMetadata('Project').find(p => !isLibrary(p))?.name || 'App').replace(/Project$/, ''));
    lines.push(`const Debug = createDebug("${debugNamespace}:Route:${className}");`);
    lines.push('const router = Router();');
    lines.push('');

    lines.push(`// GET /${pluralKebab} - List ${pluralize(entityLabel)}`);
    lines.push('router.get("/", async (req: Request, res: Response, next: NextFunction) => {');
    lines.push('  const debug = Debug.extend("find");');
    lines.push('  debug("req.query.filter %j", req.query.filter);');
    lines.push('');
    for (const line of defaultRoleGuard) lines.push(line);
    lines.push('  try {');
    lines.push('    const filter = parseFilter(req.query.filter);');
    lines.push(`    const results = await ${className}.find(filter);`);
    lines.push('    debug("results.length %j", results.length);');
    lines.push('');
    lines.push('    res.json(results);');
    lines.push('  } catch (error) {');
    lines.push('    debug("error %j", error);');
    lines.push('');
    lines.push('    next(error);');
    lines.push('  }');
    lines.push('});');

    // Class behavior routes must come before /:id to avoid being caught by the param route
    for (const route of classBehaviorRoutes) {
      const routeSegment = route.customRoutePath || `/${route.behaviorKebab}`;
      lines.push('');
      lines.push(`// ${route.httpMethod.toUpperCase()} /${pluralKebab}${routeSegment} - ${route.func.name}`);
      lines.push(`router.${route.httpMethod}("${routeSegment}", async (req: Request, res: Response, next: NextFunction) => {`);
      lines.push(`  const debug = Debug.extend("${route.func.name}");`);
      if (route.hasParams) lines.push('  debug("req.body %j", req.body);');
      lines.push('');
      for (const line of route.roleGuard) lines.push(line);
      lines.push('  try {');
      lines.push(`    const result = await ${className}.${route.func.name}(${route.callArg});`);
      lines.push('    debug("result %j", result);');
      lines.push('');
      lines.push('    res.json(result);');
      lines.push('  } catch (error) {');
      lines.push('    debug("error %j", error);');
      lines.push('');
      lines.push('    next(error);');
      lines.push('  }');
      lines.push('});');
    }

    lines.push('');

    // GET /find-one - Find one record matching filter (must be before /:id)
    lines.push(`// GET /${pluralKebab}/find-one - Find one ${entityLabel}`);
    lines.push('router.get("/find-one", async (req: Request, res: Response, next: NextFunction) => {');
    lines.push('  const debug = Debug.extend("findOne");');
    lines.push('  debug("req.query.filter %j", req.query.filter);');
    lines.push('');
    for (const line of defaultRoleGuard) lines.push(line);
    lines.push('  try {');
    lines.push('    const filter = parseFilter(req.query.filter);');
    lines.push(`    const result = await ${className}.findOne(filter);`);
    lines.push('    debug("result %j", result);');
    lines.push('');
    lines.push('    if (!result) {');
    lines.push('      res.status(404).json({ error: "No matching record found" });');
    lines.push('      return;');
    lines.push('    }');
    lines.push('    res.json(result);');
    lines.push('  } catch (error) {');
    lines.push('    debug("error %j", error);');
    lines.push('');
    lines.push('    next(error);');
    lines.push('  }');
    lines.push('});');
    lines.push('');

    // GET /:id - Get by ID
    lines.push(`// GET /${pluralKebab}/:id - Get ${entityLabel} by ID`);
    lines.push('router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {');
    lines.push('  const debug = Debug.extend("findById");');
    lines.push('  debug("req.params.id %j", req.params.id);');
    lines.push('');
    for (const line of defaultRoleGuard) lines.push(line);
    lines.push('  try {');
    lines.push('    const filter = parseFilter(req.query.filter);');
    lines.push(`    const ${varName} = await ${className}.findById(${idCoerce}, filter);`);
    lines.push(`    debug("${varName} %j", ${varName});`);
    lines.push('');
    lines.push(`    res.json(${varName});`);
    lines.push('  } catch (error) {');
    lines.push('    debug("error %j", error);');
    lines.push('');
    lines.push(`    if (error instanceof Error && error.message.includes("not found")) {`);
    lines.push('      res.status(404).json({ error: error.message });');
    lines.push('      return;');
    lines.push('    }');
    lines.push('    next(error);');
    lines.push('  }');
    lines.push('});');
    lines.push('');

    if (!isView) {
      // POST / - Create
      lines.push(`// POST /${pluralKebab} - Create ${entityLabel}`);
      lines.push('router.post("/", async (req: Request, res: Response, next: NextFunction) => {');
      lines.push('  const debug = Debug.extend("create");');
      lines.push('  debug("req.body %j", req.body);');
      lines.push('');
      for (const line of defaultRoleGuard) lines.push(line);
      lines.push('  try {');
      lines.push(`    const validated = ${schemaVarName}Schema.omit({ ${idName}: true }).parse(req.body);`);
      lines.push(`    const ${varName} = await ${className}.create(validated);`);
      lines.push(`    debug("${varName} %j", ${varName});`);
      lines.push('');
      lines.push(`    res.status(201).json(${varName});`);
      lines.push('  } catch (error) {');
      lines.push('    debug("error %j", error);');
      lines.push('');
      lines.push('    if (error instanceof z.ZodError) {');
      lines.push('      res.status(422).json({ error: "Validation failed", details: error.issues });');
      lines.push('      return;');
      lines.push('    }');
      lines.push('    next(error);');
      lines.push('  }');
      lines.push('});');
      lines.push('');

      // PATCH /:id - Update
      lines.push(`// PATCH /${pluralKebab}/:id - Update ${entityLabel}`);
      lines.push('router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {');
      lines.push('  const debug = Debug.extend("updateById");');
      lines.push('  debug("req.params.id %j", req.params.id);');
      lines.push('  debug("req.body %j", req.body);');
      lines.push('');
      for (const line of defaultRoleGuard) lines.push(line);
      lines.push('  try {');
      lines.push(`    const validated = ${schemaVarName}Schema.omit({ ${idName}: true }).partial().parse(req.body);`);
      lines.push(`    const ${varName} = await ${className}.updateById(${idCoerce}, validated);`);
      lines.push(`    debug("${varName} %j", ${varName});`);
      lines.push('');
      lines.push(`    res.json(${varName});`);
      lines.push('  } catch (error) {');
      lines.push('    debug("error %j", error);');
      lines.push('');
      lines.push('    if (error instanceof z.ZodError) {');
      lines.push('      res.status(422).json({ error: "Validation failed", details: error.issues });');
      lines.push('      return;');
      lines.push('    }');
      lines.push(`    if (error instanceof Error && error.message.includes("not found")) {`);
      lines.push('      res.status(404).json({ error: error.message });');
      lines.push('      return;');
      lines.push('    }');
      lines.push('    next(error);');
      lines.push('  }');
      lines.push('});');
      lines.push('');

      // DELETE /:id - Delete
      lines.push(`// DELETE /${pluralKebab}/:id - Delete ${entityLabel}`);
      lines.push('router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {');
      lines.push('  const debug = Debug.extend("deleteById");');
      lines.push('  debug("req.params.id %j", req.params.id);');
      lines.push('');
      for (const line of defaultRoleGuard) lines.push(line);
      lines.push('  try {');
      lines.push(`    const deleted = await ${className}.deleteById(${idCoerce});`);
      lines.push('    debug("deleted %j", deleted);');
      lines.push('');
      lines.push('    if (!deleted) {');
      lines.push(`      res.status(404).json({ error: "${entityLabel} not found" });`);
      lines.push('      return;');
      lines.push('    }');
      lines.push('    res.status(204).send();');
      lines.push('  } catch (error) {');
      lines.push('    debug("error %j", error);');
      lines.push('');
      lines.push('    next(error);');
      lines.push('  }');
      lines.push('});');
    }

    // Instance behavior routes (after /:id routes)
    for (const route of instanceBehaviorRoutes) {
      const routeSegment = route.customRoutePath || `/:id/${route.behaviorKebab}`;
      lines.push('');
      lines.push(`// ${route.httpMethod.toUpperCase()} /${pluralKebab}${routeSegment} - ${route.func.name}`);
      lines.push(`router.${route.httpMethod}("${routeSegment}", async (req: Request, res: Response, next: NextFunction) => {`);
      lines.push(`  const debug = Debug.extend("${route.func.name}");`);
      lines.push('  debug("req.params.id %j", req.params.id);');
      if (route.hasParams) lines.push('  debug("req.body %j", req.body);');
      lines.push('');
      for (const line of route.roleGuard) lines.push(line);
      lines.push('  try {');
      lines.push(`    const ${varName} = await ${className}.findById(${idCoerce});`);
      lines.push(`    const result = await ${varName}.${route.func.name}(${route.callArg});`);
      lines.push('    debug("result %j", result);');
      lines.push('');
      lines.push('    res.json(result);');
      lines.push('  } catch (error) {');
      lines.push('    debug("error %j", error);');
      lines.push('');
      lines.push(`    if (error instanceof Error && error.message.includes("not found")) {`);
      lines.push('      res.status(404).json({ error: error.message });');
      lines.push('      return;');
      lines.push('    }');
      lines.push('    next(error);');
      lines.push('  }');
      lines.push('});');
    }

    lines.push('');
    lines.push('export default router;');

    const content = lines.join('\n');
    debug('Generated route file for %j', metadata.name);

    return content;
  }
};

export { businessObjectRouteGenerator };
