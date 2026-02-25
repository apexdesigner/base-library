import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, resolveIdType, getDataSource, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase, getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:businessObject');

// Lifecycle behavior types to exclude
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

/**
 * Extract the function body text from an addBehavior() call.
 * Finds the function expression argument and returns its body text
 * (with the outer braces stripped). Body is returned unchanged.
 */
function getBehaviorBody(sourceFile: DesignMetadata['sourceFile']): string | undefined {
  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;

    const expr = statement.getExpression();
    if (!Node.isCallExpression(expr)) continue;

    const callee = expr.getExpression();
    if (!Node.isIdentifier(callee)) continue;

    const name = callee.getText();
    if (name !== 'addBehavior' && name !== 'addAppBehavior') continue;

    for (const arg of expr.getArguments()) {
      if (Node.isFunctionExpression(arg) || Node.isArrowFunction(arg)) {
        const body = arg.getBody();
        if (!Node.isBlock(body)) continue;

        const text = body.getText();
        return text.slice(1, -1);
      }
    }
  }
  return undefined;
}

/**
 * Extract the target class name from an addTestFixture(Target, fn) call.
 */
function getTestFixtureTarget(sourceFile: DesignMetadata['sourceFile']): string | undefined {
  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;

    const expr = statement.getExpression();
    if (!Node.isCallExpression(expr)) continue;

    const callee = expr.getExpression();
    if (!Node.isIdentifier(callee)) continue;
    if (callee.getText() !== 'addTestFixture') continue;

    const args = expr.getArguments();
    if (args.length < 1) continue;

    if (Node.isIdentifier(args[0])) {
      return args[0].getText();
    }
  }
  return undefined;
}

/**
 * Extract the function name and body from an addTestFixture(Target, fn) call.
 */
function getTestFixtureFunction(sourceFile: DesignMetadata['sourceFile']): { name: string; body: string; isAsync: boolean } | undefined {
  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;

    const expr = statement.getExpression();
    if (!Node.isCallExpression(expr)) continue;

    const callee = expr.getExpression();
    if (!Node.isIdentifier(callee)) continue;
    if (callee.getText() !== 'addTestFixture') continue;

    const args = expr.getArguments();
    if (args.length < 2) continue;

    const fnArg = args[1];
    if (Node.isFunctionExpression(fnArg)) {
      const fnName = fnArg.getName();
      if (!fnName) continue;

      const body = fnArg.getBody();
      if (!Node.isBlock(body)) continue;

      const text = body.getText();
      return { name: fnName, body: text.slice(1, -1), isAsync: fnArg.isAsync() };
    }
  }
  return undefined;
}

const businessObjectGenerator: DesignGenerator = {
  name: 'business-object',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata, conditionContext) => {
        if (isLibrary(metadata)) return false;
        if (!conditionContext?.context) return true;
        return !!getDataSource(metadata.sourceFile, conditionContext.context);
      },
    },
    {
      metadataType: 'Behavior',
      condition: (metadata) => !isLibrary(metadata),
    },
    {
      metadataType: 'TestFixture',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: (metadata: DesignMetadata) => {
    const name = getBehaviorParent(metadata.sourceFile) || getTestFixtureTarget(metadata.sourceFile) || metadata.name;
    return [`server/src/business-objects/${kebabCase(name)}.ts`];
  },

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // If triggered by a Behavior, resolve to the parent BO metadata
    const parentName = getBehaviorParent(metadata.sourceFile);
    if (parentName) {
      const boMeta = context.listMetadata('BusinessObject')
        .find(bo => pascalCase(bo.name) === parentName);
      if (boMeta) {
        debug('resolved behavior %j to parent BO %j', metadata.name, boMeta.name);
        metadata = boMeta;
      }
    }

    debug('START generate for %j', metadata.name);

    const className = pascalCase(metadata.name);
    const schemaVarName = camelCase(metadata.name);
    const boKebab = kebabCase(metadata.name);

    // Get id property info — resolve to a primitive TS type
    const resolved = resolveIdType(metadata.sourceFile, context);
    let idName = resolved.name;
    let idType = resolved.type;
    // If the resolved type is not a primitive (e.g. a base type class or inline import),
    // fall back to 'string' for string-based base types, 'number' otherwise
    if (idType !== 'string' && idType !== 'number') {
      idType = idType.includes('import(') || /^[A-Z]/.test(idType) ? 'string' : idType;
    }
    debug('className %j, idName %j, idType %j', className, idName, idType);

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    // Resolve which data source this BO uses
    const dsMeta = getDataSource(metadata.sourceFile, context);
    const dsKebab = dsMeta ? kebabCase(dsMeta.name) : 'unknown';
    debug('data source %j', dsMeta?.name);

    // Resolve mixins and collect lifecycle behaviors
    const mixins = resolveMixins(metadata.sourceFile, context);
    const mixinNames = mixins.map(m => m.name);
    debug('mixins %j', mixinNames);

    const allBehaviors = context.listMetadata('Behavior');
    const parentNames = new Set([className, ...mixinNames]);

    // Collect imports from matched behavior design files
    const behaviorBoImports = new Set<string>();
    let needsAppImport = false;

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;
        const parent = getBehaviorParent(behavior.sourceFile);
        if (!parentNames.has(parent)) continue;

        for (const importDecl of behavior.sourceFile.getImportDeclarations()) {
          const moduleSpecifier = importDecl.getModuleSpecifierValue();

          if (moduleSpecifier === '@business-objects') {
            for (const namedImport of importDecl.getNamedImports()) {
              const name = namedImport.getName();
              if (name !== className) {
                behaviorBoImports.add(name);
              }
            }
          } else if (moduleSpecifier === '@project') {
            needsAppImport = true;
          }
        }
      } catch (err) {
        debug('error scanning behavior imports: %j', err);
      }
    }
    // Collect imports and bodies from matched test fixture design files
    const allFixtures = context.listMetadata('TestFixture');
    interface FixtureEntry { name: string; body: string; isAsync: boolean }
    const fixtureEntries: FixtureEntry[] = [];

    for (const fixture of allFixtures) {
      try {
        const target = getTestFixtureTarget(fixture.sourceFile);
        if (!target || !parentNames.has(target)) continue;

        const func = getTestFixtureFunction(fixture.sourceFile);
        if (!func) continue;

        fixtureEntries.push(func);

        // Collect imports from fixture file
        for (const importDecl of fixture.sourceFile.getImportDeclarations()) {
          const moduleSpecifier = importDecl.getModuleSpecifierValue();

          if (moduleSpecifier === '@business-objects') {
            for (const namedImport of importDecl.getNamedImports()) {
              const name = namedImport.getName();
              if (name !== className) {
                behaviorBoImports.add(name);
              }
            }
          } else if (moduleSpecifier === '@project') {
            needsAppImport = true;
          }
        }

        debug('collected test fixture %j for %j', func.name, target);
      } catch (err) {
        debug('error scanning fixture imports: %j', err);
      }
    }

    debug('behaviorBoImports %j, needsAppImport %j', Array.from(behaviorBoImports), needsAppImport);

    // Collect lifecycle behavior bodies by type
    const lifecycleBodies = new Map<string, string[]>(); // type → body lines
    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;
        const parent = getBehaviorParent(behavior.sourceFile);
        if (!parentNames.has(parent)) continue;
        if (!LIFECYCLE_TYPES.has(options.type as string)) continue;

        const body = getBehaviorBody(behavior.sourceFile);
        if (!body) continue;

        const type = options.type as string;
        if (!lifecycleBodies.has(type)) lifecycleBodies.set(type, []);
        lifecycleBodies.get(type)!.push(body);
        debug('collected lifecycle %j from %j', type, parent);
      } catch (err) {
        debug('error collecting lifecycle behavior: %j', err);
      }
    }

    const dataTypeName = `${className}Data`;

    // Collect lifecycle behavior bodies
    const beforeCreateBodies = lifecycleBodies.get('Before Create') || [];
    const beforeUpdateBodies = lifecycleBodies.get('Before Update') || [];

    const lines: string[] = [];

    // --- Imports ---
    lines.push('import createDebug from "debug";');
    lines.push('import type {');
    lines.push('  FindFilter,');
    lines.push('  FindOneFilter,');
    lines.push('  UpdateFilter,');
    lines.push('  DeleteFilter,');
    lines.push('  WhereClause,');
    lines.push('} from "@apexdesigner/schema-persistence";');
    lines.push('import type { z } from "zod";');
    lines.push(`import { ${schemaVarName}Schema } from "../schemas/business-objects/${boKebab}.js";`);
    lines.push(`import { dataSource } from "../data-sources/${dsKebab}.js";`);

    // Add behavior-referenced imports
    if (needsAppImport) {
      lines.push('import { App } from "../app.js";');
    }
    for (const boName of Array.from(behaviorBoImports).sort()) {
      lines.push(`import { ${boName} } from "./${kebabCase(boName)}.js";`);
    }

    lines.push('');

    // --- Debug + Data type ---
    lines.push(`const Debug = createDebug("${debugNamespace}:BusinessObject:${className}");`);
    lines.push('');
    lines.push(`type ${dataTypeName} = z.infer<typeof ${schemaVarName}Schema>;`);
    lines.push('');

    // --- Interface + Class declaration ---
    lines.push(`export interface ${className} extends Readonly<${dataTypeName}> {}`);
    lines.push(`export class ${className} {`);
    lines.push(`  static readonly entityName = "${className}" as const;`);
    lines.push(`  static dataSource = dataSource;`);
    lines.push('');
    lines.push(`  constructor(data: ${dataTypeName}) {`);
    lines.push('    Object.assign(this, data);');
    lines.push('  }');

    // --- Static CRUD methods ---
    lines.push('');
    lines.push('  // --- Static CRUD methods ---');

    // find
    lines.push('');
    lines.push(`  static async find(filter?: FindFilter<${dataTypeName}>): Promise<${className}[]> {`);
    lines.push('    const debug = Debug.extend("find");');
    lines.push('    debug("filter %j", filter);');
    lines.push('');
    lines.push(`    const results = await this.dataSource.find(this.entityName, filter);`);
    lines.push('    debug("results.length %j", results.length);');
    lines.push('');
    lines.push(`    return results.map((data: ${dataTypeName}) => new ${className}(data));`);
    lines.push('  }');

    // findOne
    lines.push('');
    lines.push(`  static async findOne(`);
    lines.push(`    filter: FindOneFilter<${dataTypeName}>,`);
    lines.push(`  ): Promise<${className} | null> {`);
    lines.push('    const debug = Debug.extend("findOne");');
    lines.push('    debug("filter %j", filter);');
    lines.push('');
    lines.push(`    const data = await this.dataSource.findOne(this.entityName, filter);`);
    lines.push('    debug("data %j", data);');
    lines.push('');
    lines.push(`    return data ? new ${className}(data) : null;`);
    lines.push('  }');

    // findById
    lines.push('');
    lines.push(`  static async findById(`);
    lines.push(`    id: ${idType},`);
    lines.push('    filter?: {');
    lines.push(`      include?: FindFilter<${dataTypeName}>["include"];`);
    lines.push(`      fields?: FindFilter<${dataTypeName}>["fields"];`);
    lines.push(`      omit?: FindFilter<${dataTypeName}>["omit"];`);
    lines.push('    },');
    lines.push(`  ): Promise<${className}> {`);
    lines.push('    const debug = Debug.extend("findById");');
    lines.push('    debug("id %j", id);');
    lines.push('');
    lines.push(`    const data = await this.dataSource.findById(this.entityName, id, filter);`);
    lines.push('    debug("data %j", data);');
    lines.push('');
    lines.push(`    if (!data) throw new Error(\`${className} not found: \${id}\`);`);
    lines.push(`    return new ${className}(data);`);
    lines.push('  }');

    // findOrCreate
    lines.push('');
    lines.push(`  static async findOrCreate(options: {`);
    lines.push(`    where: WhereClause<${dataTypeName}>;`);
    lines.push(`    create: Omit<${dataTypeName}, "${idName}">;`);
    lines.push(`  }): Promise<{ entity: ${className}; created: boolean }> {`);
    lines.push('    const debug = Debug.extend("findOrCreate");');
    lines.push('    debug("options.where %j", options.where);');
    lines.push('');
    lines.push(`    const result = await this.dataSource.findOrCreate(`);
    lines.push(`      this.entityName,`);
    lines.push(`      options,`);
    lines.push(`    );`);
    lines.push('    debug("result.created %j", result.created);');
    lines.push('');
    lines.push(`    return { entity: new ${className}(result.entity), created: result.created };`);
    lines.push('  }');

    // count
    lines.push('');
    lines.push(`  static async count(where?: WhereClause<${dataTypeName}>): Promise<number> {`);
    lines.push('    const debug = Debug.extend("count");');
    lines.push('    debug("where %j", where);');
    lines.push('');
    lines.push(`    const result = await this.dataSource.count(`);
    lines.push(`      this.entityName,`);
    lines.push(`      where ? { where } : undefined,`);
    lines.push(`    );`);
    lines.push('    debug("result %j", result);');
    lines.push('');
    lines.push('    return result;');
    lines.push('  }');

    // create
    lines.push('');
    lines.push(`  static async create(data: Omit<${dataTypeName}, "${idName}">): Promise<${className}> {`);
    lines.push('    const debug = Debug.extend("create");');
    lines.push('    debug("data %j", data);');
    lines.push('');
    // Inline Before Create lifecycle behaviors
    if (beforeCreateBodies.length > 0) {
      lines.push(`    const Model = this;`);
      lines.push(`    const dataItems = [data];`);
      for (const body of beforeCreateBodies) {
        for (const line of body.split('\n')) {
          lines.push(`  ${line}`);
        }
      }
    }
    lines.push(`    const created = await this.dataSource.create(this.entityName, data);`);
    lines.push('    debug("created %j", created);');
    lines.push('');
    lines.push(`    return new ${className}(created);`);
    lines.push('  }');

    // createMany
    lines.push('');
    lines.push(`  static async createMany(`);
    lines.push(`    data: Omit<${dataTypeName}, "${idName}">[],`);
    lines.push(`  ): Promise<${className}[]> {`);
    lines.push('    const debug = Debug.extend("createMany");');
    lines.push('    debug("data.length %j", data.length);');
    lines.push('');
    // Inline Before Create lifecycle behaviors (data is already an array)
    if (beforeCreateBodies.length > 0) {
      lines.push(`    const Model = this;`);
      lines.push(`    const dataItems = data;`);
      for (const body of beforeCreateBodies) {
        for (const line of body.split('\n')) {
          lines.push(`  ${line}`);
        }
      }
    }
    lines.push(`    const results = await this.dataSource.createMany(this.entityName, data);`);
    lines.push('    debug("results.length %j", results.length);');
    lines.push('');
    lines.push(`    return results.map((item: ${dataTypeName}) => new ${className}(item));`);
    lines.push('  }');

    // update
    lines.push('');
    lines.push(`  static async update(`);
    lines.push(`    filter: UpdateFilter<${dataTypeName}>,`);
    lines.push(`    data: Partial<${dataTypeName}>,`);
    lines.push(`  ): Promise<${className}[]> {`);
    lines.push('    const debug = Debug.extend("update");');
    lines.push('    debug("filter %j", filter);');
    lines.push('    debug("data %j", data);');
    lines.push('');
    // Inline Before Update lifecycle behaviors
    if (beforeUpdateBodies.length > 0) {
      lines.push(`    const Model = this;`);
      lines.push(`    const where = filter.where;`);
      lines.push(`    const updates = data;`);
      for (const body of beforeUpdateBodies) {
        for (const line of body.split('\n')) {
          lines.push(`  ${line}`);
        }
      }
    }
    lines.push(`    const results = await this.dataSource.update(`);
    lines.push(`      this.entityName,`);
    lines.push(`      filter,`);
    lines.push(`      data,`);
    lines.push(`    );`);
    lines.push('    debug("results.length %j", results.length);');
    lines.push('');
    lines.push(`    return results.map((item: ${dataTypeName}) => new ${className}(item));`);
    lines.push('  }');

    // updateById
    lines.push('');
    lines.push(`  static async updateById(`);
    lines.push(`    id: ${idType},`);
    lines.push(`    data: Partial<${dataTypeName}>,`);
    lines.push(`  ): Promise<${className}> {`);
    lines.push('    const debug = Debug.extend("updateById");');
    lines.push('    debug("id %j", id);');
    lines.push('    debug("data %j", data);');
    lines.push('');
    // Inline Before Update lifecycle behaviors
    if (beforeUpdateBodies.length > 0) {
      lines.push(`    const Model = this;`);
      lines.push(`    const where = { id };`);
      lines.push(`    const updates = data;`);
      for (const body of beforeUpdateBodies) {
        for (const line of body.split('\n')) {
          lines.push(`  ${line}`);
        }
      }
    }
    lines.push(`    const updated = await this.dataSource.updateById(`);
    lines.push(`      this.entityName,`);
    lines.push(`      id,`);
    lines.push(`      data,`);
    lines.push(`    );`);
    lines.push('    debug("updated %j", updated);');
    lines.push('');
    lines.push(`    if (!updated) throw new Error(\`${className} not found: \${id}\`);`);
    lines.push(`    return new ${className}(updated);`);
    lines.push('  }');

    // upsert
    lines.push('');
    lines.push(`  static async upsert(options: {`);
    lines.push(`    where: WhereClause<${dataTypeName}>;`);
    lines.push(`    create: Omit<${dataTypeName}, "${idName}">;`);
    lines.push(`    update: Partial<${dataTypeName}>;`);
    lines.push(`  }): Promise<${className}> {`);
    lines.push('    const debug = Debug.extend("upsert");');
    lines.push('    debug("options.where %j", options.where);');
    lines.push('');
    lines.push(`    const result = await this.dataSource.upsert(this.entityName, options);`);
    lines.push('    debug("result %j", result);');
    lines.push('');
    lines.push(`    return new ${className}(result);`);
    lines.push('  }');

    // delete
    lines.push('');
    lines.push(`  static async delete(filter: DeleteFilter<${dataTypeName}>): Promise<number> {`);
    lines.push('    const debug = Debug.extend("delete");');
    lines.push('    debug("filter %j", filter);');
    lines.push('');
    lines.push(`    const result = await this.dataSource.delete(this.entityName, filter);`);
    lines.push('    debug("result %j", result);');
    lines.push('');
    lines.push('    return result;');
    lines.push('  }');

    // deleteById
    lines.push('');
    lines.push(`  static async deleteById(id: ${idType}): Promise<boolean> {`);
    lines.push('    const debug = Debug.extend("deleteById");');
    lines.push('    debug("id %j", id);');
    lines.push('');
    lines.push(`    const result = await this.dataSource.deleteById(this.entityName, id);`);
    lines.push('    debug("result %j", result);');
    lines.push('');
    lines.push('    return result;');
    lines.push('  }');

    // --- Instance and Class behaviors ---
    debug('total behaviors in project %j', allBehaviors.length);

    const behaviorMethods: string[] = [];

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const parent = getBehaviorParent(behavior.sourceFile);
        if (!parentNames.has(parent)) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        // Skip lifecycle behaviors
        if (LIFECYCLE_TYPES.has(options.type as string)) continue;

        const isInstance = options.type === 'Instance';
        const isAsync = func.isAsync;

        // Get parameters: skip first for instance behaviors (it's the instance itself)
        const params = func.parameters || [];
        const methodParams = isInstance ? params.slice(1) : params;
        const instanceParamName = isInstance && params.length > 0 ? params[0].name : undefined;

        // Get the function body from the AST (unchanged)
        const body = getBehaviorBody(behavior.sourceFile);
        if (!body) {
          debug('no body found for behavior %j', func.name);
          continue;
        }

        // Build parameter string
        const paramStr = methodParams
          .map(p => {
            const optional = p.isOptional ? '?' : '';
            return `${p.name}${optional}: ${p.type}`;
          })
          .join(', ');

        // Build method
        const asyncPrefix = isAsync ? 'async ' : '';
        const staticPrefix = isInstance ? '' : 'static ';

        const methodLines: string[] = [];
        methodLines.push('');
        methodLines.push(`  ${staticPrefix}${asyncPrefix}${func.name}(${paramStr}) {`);

        // For instance behaviors, alias 'this' to the original parameter name
        if (instanceParamName) {
          methodLines.push(`    const ${instanceParamName} = this;`);
        }

        // Inject scoped debug for behavior methods
        methodLines.push(`    const debug = Debug.extend("${func.name}");`);

        // Add the body lines unchanged
        const bodyLines = body.split('\n');
        for (const line of bodyLines) {
          methodLines.push(`  ${line}`);
        }

        methodLines.push('  }');

        behaviorMethods.push(methodLines.join('\n'));

        debug('added behavior method %j (instance: %j)', func.name, isInstance);
      } catch (err) {
        debug('error processing behavior %j: %j', behavior.name, err);
      }
    }

    if (behaviorMethods.length > 0) {
      lines.push('');
      lines.push('  // --- Behaviors ---');
      lines.push(behaviorMethods.join(''));
    }

    // --- Test fixtures ---
    if (fixtureEntries.length > 0) {
      fixtureEntries.sort((a, b) => a.name.localeCompare(b.name));
      lines.push('');
      lines.push('  static testFixtures = {');

      for (const fixture of fixtureEntries) {
        const asyncPrefix = fixture.isAsync ? 'async ' : '';
        lines.push(`    ${asyncPrefix}${fixture.name}() {`);

        for (const line of fixture.body.split('\n')) {
          lines.push(`    ${line}`);
        }

        lines.push('    },');
      }

      lines.push('  };');
    }

    // Close class
    lines.push('}');

    const content = lines.join('\n');
    debug('Generated business object file for %j', metadata.name);

    return content;
  }
};

export { businessObjectGenerator };
