import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getIdProperty, getDataSource, resolveMixins } from '@apexdesigner/generator';
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
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `server/src/business-objects/${kebabCase(metadata.name)}.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);

    const className = pascalCase(metadata.name);
    const schemaVarName = camelCase(metadata.name);
    const boKebab = kebabCase(metadata.name);

    // Get id property info
    const idProperty = getIdProperty(metadata.sourceFile, context);
    const idName = idProperty.name;
    debug('className %j, idName %j', className, idName);

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase(projectMeta?.name || 'App');

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
    lines.push('');

    // --- Debug + Data type ---
    lines.push(`const debug = createDebug("${debugNamespace}:BusinessObject:${className}");`);
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
    lines.push(`    const results = await this.dataSource.find(this.entityName, filter);`);
    lines.push(`    return results.map((data: ${dataTypeName}) => new ${className}(data));`);
    lines.push('  }');

    // findOne
    lines.push('');
    lines.push(`  static async findOne(`);
    lines.push(`    filter: FindOneFilter<${dataTypeName}>,`);
    lines.push(`  ): Promise<${className} | null> {`);
    lines.push(`    const data = await this.dataSource.findOne(this.entityName, filter);`);
    lines.push(`    return data ? new ${className}(data) : null;`);
    lines.push('  }');

    // findById
    lines.push('');
    lines.push(`  static async findById(`);
    lines.push(`    id: string | number,`);
    lines.push('    filter?: {');
    lines.push(`      include?: FindFilter<${dataTypeName}>["include"];`);
    lines.push(`      fields?: FindFilter<${dataTypeName}>["fields"];`);
    lines.push(`      omit?: FindFilter<${dataTypeName}>["omit"];`);
    lines.push('    },');
    lines.push(`  ): Promise<${className}> {`);
    lines.push(`    const data = await this.dataSource.findById(this.entityName, id, filter);`);
    lines.push(`    if (!data) throw new Error(\`${className} not found: \${id}\`);`);
    lines.push(`    return new ${className}(data);`);
    lines.push('  }');

    // findOrCreate
    lines.push('');
    lines.push(`  static async findOrCreate(options: {`);
    lines.push(`    where: WhereClause<${dataTypeName}>;`);
    lines.push(`    create: Omit<${dataTypeName}, "${idName}">;`);
    lines.push(`  }): Promise<{ entity: ${className}; created: boolean }> {`);
    lines.push(`    const result = await this.dataSource.findOrCreate(`);
    lines.push(`      this.entityName,`);
    lines.push(`      options,`);
    lines.push(`    );`);
    lines.push(`    return { entity: new ${className}(result.entity), created: result.created };`);
    lines.push('  }');

    // count
    lines.push('');
    lines.push(`  static async count(where?: WhereClause<${dataTypeName}>): Promise<number> {`);
    lines.push(`    return this.dataSource.count(`);
    lines.push(`      this.entityName,`);
    lines.push(`      where ? { where } : undefined,`);
    lines.push(`    );`);
    lines.push('  }');

    // create
    lines.push('');
    lines.push(`  static async create(data: Omit<${dataTypeName}, "${idName}">): Promise<${className}> {`);
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
    lines.push(`    return new ${className}(created);`);
    lines.push('  }');

    // createMany
    lines.push('');
    lines.push(`  static async createMany(`);
    lines.push(`    data: Omit<${dataTypeName}, "${idName}">[],`);
    lines.push(`  ): Promise<${className}[]> {`);
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
    lines.push(`    return results.map((item: ${dataTypeName}) => new ${className}(item));`);
    lines.push('  }');

    // update
    lines.push('');
    lines.push(`  static async update(`);
    lines.push(`    filter: UpdateFilter<${dataTypeName}>,`);
    lines.push(`    data: Partial<${dataTypeName}>,`);
    lines.push(`  ): Promise<${className}[]> {`);
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
    lines.push(`    return results.map((item: ${dataTypeName}) => new ${className}(item));`);
    lines.push('  }');

    // updateById
    lines.push('');
    lines.push(`  static async updateById(`);
    lines.push(`    id: string,`);
    lines.push(`    data: Partial<${dataTypeName}>,`);
    lines.push(`  ): Promise<${className}> {`);
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
    lines.push(`    const result = await this.dataSource.upsert(this.entityName, options);`);
    lines.push(`    return new ${className}(result);`);
    lines.push('  }');

    // delete
    lines.push('');
    lines.push(`  static async delete(filter: DeleteFilter<${dataTypeName}>): Promise<number> {`);
    lines.push(`    return this.dataSource.delete(this.entityName, filter);`);
    lines.push('  }');

    // deleteById
    lines.push('');
    lines.push(`  static async deleteById(id: string): Promise<boolean> {`);
    lines.push(`    return this.dataSource.deleteById(this.entityName, id);`);
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

    // Close class
    lines.push('}');

    const content = lines.join('\n');
    debug('Generated business object file for %j', metadata.name);

    return content;
  }
};

export { businessObjectGenerator };
