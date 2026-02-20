import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getDataSource, getIdProperty, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase, getDescription, getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import pluralize from 'pluralize';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:businessObjectRoute');

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
  'After Start',
]);

// HTTP methods for behaviors
const BEHAVIOR_HTTP_METHODS: Record<string, string> = {
  Post: 'post',
  Put: 'put',
  Patch: 'patch',
  Get: 'get',
  Delete: 'delete',
};

const businessObjectRouteGenerator: DesignGenerator = {
  name: 'business-object-route',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata, conditionContext) => {
        if (isLibrary(metadata)) return false;
        if (!conditionContext?.context) return true;
        return !!getDataSource(metadata.sourceFile, conditionContext.context);
      },
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `server/src/routes/${kebabCase(pluralize(metadata.name))}.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);

    const className = pascalCase(metadata.name);
    const varName = camelCase(metadata.name);
    const schemaVarName = camelCase(metadata.name);
    const pluralKebab = kebabCase(pluralize(metadata.name));
    const entityLabel = metadata.name;

    debug('className %j, pluralKebab %j', className, pluralKebab);

    // Get id property info
    const idProperty = getIdProperty(metadata.sourceFile, context);
    let idType = 'number';
    if (idProperty.type === 'string' || idProperty.type === 'String') {
      idType = 'string';
    }

    const lines: string[] = [];

    // Imports
    lines.push(`import createDebug from "debug";`);
    lines.push(`import { Router, Request, Response, NextFunction } from "express";`);
    lines.push(`import { z } from "zod";`);
    lines.push(`import { ${className} } from "../business-objects/${kebabCase(metadata.name)}.js";`);
    lines.push(`import { ${schemaVarName}Schema } from "../schemas/business-objects/${kebabCase(metadata.name)}.js";`);
    lines.push('');

    // Debug and router setup
    lines.push(`const debug = createDebug("${pascalCase(context.listMetadata('Project').find(p => !isLibrary(p))?.name || 'App')}:Routes:${className}");`);
    lines.push('const router = Router();');
    lines.push('');

    // Parse filter helper
    lines.push('function parseFilter(query: unknown) {');
    lines.push('  if (typeof query === "string") {');
    lines.push('    return JSON.parse(query);');
    lines.push('  }');
    lines.push('  return undefined;');
    lines.push('}');
    lines.push('');

    // GET / - List
    lines.push(`// GET /${pluralKebab} - List ${pluralize(entityLabel)}`);
    lines.push('router.get("/", async (req: Request, res: Response, next: NextFunction) => {');
    lines.push('  try {');
    lines.push('    const filter = parseFilter(req.query.filter);');
    lines.push(`    const results = await ${className}.find(filter);`);
    lines.push('    res.json(results);');
    lines.push('  } catch (error) {');
    lines.push('    next(error);');
    lines.push('  }');
    lines.push('});');
    lines.push('');

    // GET /:id - Get by ID
    lines.push(`// GET /${pluralKebab}/:id - Get ${entityLabel} by ID`);
    lines.push('router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {');
    lines.push('  try {');
    lines.push('    const filter = parseFilter(req.query.filter);');
    lines.push(`    const ${varName} = await ${className}.findById(String(req.params.id), filter);`);
    lines.push(`    res.json(${varName});`);
    lines.push('  } catch (error) {');
    lines.push(`    if (error instanceof Error && error.message.includes("not found")) {`);
    lines.push('      res.status(404).json({ error: error.message });');
    lines.push('      return;');
    lines.push('    }');
    lines.push('    next(error);');
    lines.push('  }');
    lines.push('});');
    lines.push('');

    // POST / - Create
    lines.push(`// POST /${pluralKebab} - Create ${entityLabel}`);
    lines.push('router.post("/", async (req: Request, res: Response, next: NextFunction) => {');
    lines.push('  try {');
    lines.push(`    const validated = ${schemaVarName}Schema.omit({ ${idProperty.name}: true }).parse(req.body);`);
    lines.push(`    const ${varName} = await ${className}.create(validated);`);
    lines.push(`    res.status(201).json(${varName});`);
    lines.push('  } catch (error) {');
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
    lines.push('  try {');
    lines.push(`    const validated = ${schemaVarName}Schema.omit({ ${idProperty.name}: true }).partial().parse(req.body);`);
    lines.push(`    const ${varName} = await ${className}.updateById(String(req.params.id), validated);`);
    lines.push(`    res.json(${varName});`);
    lines.push('  } catch (error) {');
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
    lines.push('  try {');
    lines.push(`    const deleted = await ${className}.deleteById(String(req.params.id));`);
    lines.push('    if (!deleted) {');
    lines.push(`      res.status(404).json({ error: "${entityLabel} not found" });`);
    lines.push('      return;');
    lines.push('    }');
    lines.push('    res.status(204).send();');
    lines.push('  } catch (error) {');
    lines.push('    next(error);');
    lines.push('  }');
    lines.push('});');

    // Find and add behavior routes (BO + mixin behaviors)
    const mixins = resolveMixins(metadata.sourceFile, context);
    const parentNames = new Set([className, ...mixins.map(m => m.name)]);
    const allBehaviors = context.listMetadata('Behavior');
    debug('total behaviors in project %j', allBehaviors.length);

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const parent = getBehaviorParent(behavior.sourceFile);
        if (!parentNames.has(parent)) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        // Skip lifecycle behaviors
        if (LIFECYCLE_TYPES.has(options.type)) continue;

        const isInstance = options.type === 'Instance';
        const httpMethod = BEHAVIOR_HTTP_METHODS[options.httpMethod || 'Post'] || 'post';
        const behaviorKebab = kebabCase(func.name);

        lines.push('');

        if (isInstance) {
          // Instance behavior: POST /:id/behavior-name
          lines.push(`// ${httpMethod.toUpperCase()} /${pluralKebab}/:id/${behaviorKebab} - ${func.name}`);
          lines.push(`router.${httpMethod}("/:id/${behaviorKebab}", async (req: Request, res: Response, next: NextFunction) => {`);
          lines.push('  try {');
          lines.push(`    const ${varName} = await ${className}.findById(String(req.params.id));`);
          lines.push(`    const result = await ${varName}.${func.name}(req.body);`);
          lines.push('    res.json(result);');
          lines.push('  } catch (error) {');
          lines.push(`    if (error instanceof Error && error.message.includes("not found")) {`);
          lines.push('      res.status(404).json({ error: error.message });');
          lines.push('      return;');
          lines.push('    }');
          lines.push('    next(error);');
          lines.push('  }');
          lines.push('});');
        } else {
          // Class behavior: POST /behavior-name
          lines.push(`// ${httpMethod.toUpperCase()} /${pluralKebab}/${behaviorKebab} - ${func.name}`);
          lines.push(`router.${httpMethod}("/${behaviorKebab}", async (req: Request, res: Response, next: NextFunction) => {`);
          lines.push('  try {');
          lines.push(`    const result = await ${className}.${func.name}(req.body);`);
          lines.push('    res.json(result);');
          lines.push('  } catch (error) {');
          lines.push('    next(error);');
          lines.push('  }');
          lines.push('});');
        }

        debug('added route for behavior %j (instance: %j, method: %j)', func.name, isInstance, httpMethod);
      } catch (err) {
        debug('error processing behavior %j: %j', behavior.name, err);
      }
    }

    lines.push('');
    lines.push('export default router;');

    const content = lines.join('\n');
    debug('Generated route file for %j', metadata.name);

    return content;
  }
};

export { businessObjectRouteGenerator };
