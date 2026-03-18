import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, resolveIdType, getDataSource, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase, getBehaviorFunction, getBehaviorOptions, getBehaviorParent, getModuleLevelCall } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:businessObject');

// Modules to skip when collecting imports from behavior design files
// Note: @business-objects and @app are handled explicitly in the import loop
const SKIP_MODULES = new Set(['@apexdesigner/dsl', '@roles', '@mixins', 'vitest', 'debug']);

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
  'After Start'
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

interface LifecycleEntry {
  body: string;
  parentName: string;
}

/**
 * Extract the mixin options argument from an apply*Mixin(Target, options) call.
 */
function getMixinApplyOptions(boSourceFile: DesignMetadata['sourceFile'], mixinName: string): string | undefined {
  const applyFnName = `apply${pascalCase(mixinName)}Mixin`;
  for (const statement of boSourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;
    const expr = statement.getExpression();
    if (!Node.isCallExpression(expr)) continue;
    const callee = expr.getExpression();
    if (!Node.isIdentifier(callee) || callee.getText() !== applyFnName) continue;
    const args = expr.getArguments();
    if (args.length >= 2) {
      return args[1].getText();
    }
  }
  return undefined;
}

/**
 * Emit inline lifecycle behavior code wrapped in a scope block.
 * Provides Model, optional mixinOptions, and context variables.
 */
function emitLifecycleInline(
  entries: LifecycleEntry[],
  lines: string[],
  contextVars: Record<string, string>,
  mixinNames: string[],
  mixinOptionsMap: Map<string, string>
): void {
  if (entries.length === 0) return;
  for (const entry of entries) {
    lines.push(`    {`);
    lines.push(`      const Model = this;`);
    const isMixin = mixinNames.includes(entry.parentName);
    if (isMixin && mixinOptionsMap.has(entry.parentName)) {
      lines.push(`      const mixinOptions = ${mixinOptionsMap.get(entry.parentName)} as const;`);
    }
    for (const [varName, value] of Object.entries(contextVars)) {
      lines.push(`      const ${varName} = ${value};`);
    }
    for (const line of entry.body.split('\n')) {
      lines.push(`    ${line}`);
    }
    lines.push(`    }`);
  }
}

const businessObjectGenerator: DesignGenerator = {
  name: 'business-object',

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
    },
    {
      metadataType: 'TestFixture'
    }
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
      const boMeta = context.listMetadata('BusinessObject').find(bo => pascalCase(bo.name) === parentName);
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

    // Detect view-backed BO
    const isView = !!getModuleLevelCall(metadata.sourceFile, 'setView');
    debug('isView %j', isView);

    // Resolve which data source this BO uses
    const dsMeta = getDataSource(metadata.sourceFile, context);
    const dsKebab = dsMeta ? kebabCase(dsMeta.name) : 'unknown';
    debug('data source %j', dsMeta?.name);

    // Resolve mixins and collect lifecycle behaviors
    const mixins = resolveMixins(metadata.sourceFile, context);
    const mixinNames = mixins.map(m => m.name);
    debug('mixins %j', mixinNames);

    // Build mixin options map from all applied mixins (for static property)
    const allMixinOptions = new Map<string, string>();
    for (const mixin of mixins) {
      const optionsText = getMixinApplyOptions(metadata.sourceFile, mixin.name);
      if (optionsText) {
        allMixinOptions.set(mixin.name, optionsText);
      }
    }

    const allBehaviors = context.listMetadata('Behavior');
    const parentNames = new Set([className, ...mixinNames]);

    // Collect imports from matched behavior design files
    const behaviorBoImports = new Set<string>();
    let needsAppImport = false;
    const defaultImports = new Map<string, string>(); // module → default import name
    const externalNamedImports = new Map<string, Set<string>>(); // module → set of named imports

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;
        const parent = getBehaviorParent(behavior.sourceFile);
        if (!parent || !parentNames.has(parent)) continue;

        for (const importDecl of behavior.sourceFile.getImportDeclarations()) {
          const moduleSpecifier = importDecl.getModuleSpecifierValue();

          if (SKIP_MODULES.has(moduleSpecifier)) continue;

          if (moduleSpecifier === '@business-objects') {
            for (const namedImport of importDecl.getNamedImports()) {
              const name = namedImport.getName();
              if (name !== className) {
                behaviorBoImports.add(name);
              }
            }
            continue;
          }

          if (moduleSpecifier === '@app') {
            needsAppImport = true;
            continue;
          }

          if (moduleSpecifier === '@functions') {
            for (const namedImport of importDecl.getNamedImports()) {
              const name = namedImport.getName();
              const fnModule = `../functions/${kebabCase(name)}.js`;
              if (!externalNamedImports.has(fnModule)) externalNamedImports.set(fnModule, new Set());
              externalNamedImports.get(fnModule)!.add(name);
            }
            continue;
          }

          // Map design-time aliases to generated paths
          let mappedModule = moduleSpecifier;
          if (moduleSpecifier.startsWith('@server-node-modules/')) {
            mappedModule = moduleSpecifier.replace('@server-node-modules/', '');
          } else if (moduleSpecifier.startsWith('@server/')) {
            mappedModule = moduleSpecifier.replace('@server/', '../') + '.js';
          }

          // Handle default import
          const defaultImport = importDecl.getDefaultImport();
          if (defaultImport) {
            defaultImports.set(mappedModule, defaultImport.getText());
          }

          // Handle named imports
          for (const named of importDecl.getNamedImports()) {
            if (!externalNamedImports.has(mappedModule)) externalNamedImports.set(mappedModule, new Set());
            externalNamedImports.get(mappedModule)!.add(named.getName());
          }
        }
      } catch (err) {
        debug('error scanning behavior imports: %j', err);
      }
    }
    // Collect imports and bodies from matched test fixture design files
    const allFixtures = context.listMetadata('TestFixture');
    interface FixtureEntry {
      name: string;
      body: string;
      isAsync: boolean;
    }
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
          } else if (moduleSpecifier === '@app') {
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
    const lifecycleBodies = new Map<string, LifecycleEntry[]>();
    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;
        const parent = getBehaviorParent(behavior.sourceFile);
        if (!parent || !parentNames.has(parent)) continue;
        if (!LIFECYCLE_TYPES.has(options.type as string)) continue;

        const body = getBehaviorBody(behavior.sourceFile);
        if (!body) continue;

        const type = options.type as string;
        if (!lifecycleBodies.has(type)) lifecycleBodies.set(type, []);
        lifecycleBodies.get(type)!.push({ body, parentName: parent });
        debug('collected lifecycle %j from %j', type, parent);
      } catch (err) {
        debug('error collecting lifecycle behavior: %j', err);
      }
    }

    // Pre-compute mixin options map for lifecycle behaviors that need config
    const mixinOptionsMap = new Map<string, string>();
    for (const [, entries] of lifecycleBodies) {
      for (const entry of entries) {
        if (!mixinNames.includes(entry.parentName)) continue;
        if (mixinOptionsMap.has(entry.parentName)) continue;

        const mixinMeta = context.listMetadata('Mixin').find(m => pascalCase(m.name) === entry.parentName);
        if (!mixinMeta) continue;

        const configName = `${entry.parentName}Config`;
        const hasConfig = mixinMeta.sourceFile.getInterfaces().some(i => i.getName() === configName && i.isExported());
        if (!hasConfig) continue;

        const optionsText = getMixinApplyOptions(metadata.sourceFile, mixinMeta.name);
        if (optionsText) {
          mixinOptionsMap.set(entry.parentName, optionsText);
          // Collect BO imports referenced in mixin options
          for (const bo of context.listMetadata('BusinessObject')) {
            const boName = pascalCase(bo.name);
            if (boName !== className && optionsText.includes(boName)) {
              behaviorBoImports.add(boName);
            }
          }
        }
      }
    }

    const dataTypeName = `${className}Data`;

    // Collect lifecycle behavior bodies
    const beforeCreateEntries = lifecycleBodies.get('Before Create') || [];
    const beforeUpdateEntries = lifecycleBodies.get('Before Update') || [];
    const afterCreateEntries = lifecycleBodies.get('After Create') || [];
    const afterUpdateEntries = lifecycleBodies.get('After Update') || [];
    const beforeDeleteEntries = lifecycleBodies.get('Before Delete') || [];
    const afterDeleteEntries = lifecycleBodies.get('After Delete') || [];
    const beforeReadEntries = lifecycleBodies.get('Before Read') || [];
    const afterReadEntries = lifecycleBodies.get('After Read') || [];

    const lines: string[] = [];

    // --- Imports ---
    lines.push('import createDebug from "debug";');
    lines.push('import type { z } from "zod";');
    lines.push(`import { ${schemaVarName}Schema } from "../schemas/business-objects/${boKebab}.js";`);
    lines.push(`import type { ${className}ArrayFilter, ${className}ObjectFilter, ${className}WhereFilter } from "../filters/${boKebab}.js";`);
    lines.push('import { dataSource } from "../data-sources/index.js";');

    // Add behavior-referenced imports
    if (needsAppImport) {
      lines.push('import { App } from "../app.js";');
    }
    for (const boName of Array.from(behaviorBoImports).sort()) {
      lines.push(`import { ${boName} } from "./${kebabCase(boName)}.js";`);
    }

    // Default imports from external packages (e.g., import fs from "node:fs")
    for (const [module, name] of Array.from(defaultImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`import ${name} from "${module}";`);
    }

    // Named imports from external packages (e.g., import { match } from "path-to-regexp")
    for (const [module, names] of Array.from(externalNamedImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const sortedNames = Array.from(names).sort();
      lines.push(`import { ${sortedNames.join(', ')} } from "${module}";`);
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
    lines.push(`  static schema = ${schemaVarName}Schema;`);
    lines.push(`  static dataSource = dataSource;`);
    if (allMixinOptions.size > 0) {
      lines.push(`  static readonly mixinOptions = {`);
      for (const [mixinName, optionsText] of allMixinOptions) {
        lines.push(`    ${camelCase(mixinName)}: ${optionsText},`);
      }
      lines.push(`  } as const;`);
    }
    lines.push('');
    lines.push(`  constructor(data: ${dataTypeName}) {`);
    lines.push('    Object.assign(this, data);');
    lines.push('  }');

    // --- Static CRUD methods ---
    lines.push('');
    lines.push('  // --- Static CRUD methods ---');

    // find
    lines.push('');
    lines.push(`  static async find(filter?: ${className}ArrayFilter): Promise<${className}[]> {`);
    lines.push('    const debug = Debug.extend("find");');
    lines.push('    debug("filter %j", filter);');
    lines.push('');
    // Inline Before Read lifecycle behaviors
    if (beforeReadEntries.length > 0) {
      lines.push('    if (!filter) filter = {};');
      lines.push('    if (!filter.where) filter.where = {} as any;');
    }
    emitLifecycleInline(beforeReadEntries, lines, { where: 'filter.where!' }, mixinNames, mixinOptionsMap);
    lines.push(`    const results = await this.dataSource.find(this.entityName, filter as any);`);
    lines.push('    debug("results.length %j", results.length);');
    lines.push('');
    // Inline After Read lifecycle behaviors
    emitLifecycleInline(afterReadEntries, lines, { instances: 'results' }, mixinNames, mixinOptionsMap);
    lines.push(`    return results.map((data: ${dataTypeName}) => new ${className}(data));`);
    lines.push('  }');

    // findOne
    lines.push('');
    lines.push(`  static async findOne(`);
    lines.push(`    filter: { where: ${className}WhereFilter; include?: ${className}ArrayFilter['include']; fields?: string[]; omit?: string[] },`);
    lines.push(`  ): Promise<${className} | null> {`);
    lines.push('    const debug = Debug.extend("findOne");');
    lines.push('    debug("filter %j", filter);');
    lines.push('');
    // Inline Before Read lifecycle behaviors
    if (beforeReadEntries.length > 0) {
      lines.push('    if (!filter) filter = {} as any;');
      lines.push('    if (!filter.where) filter.where = {} as any;');
    }
    emitLifecycleInline(beforeReadEntries, lines, { where: 'filter.where!' }, mixinNames, mixinOptionsMap);
    lines.push(`    const data = await this.dataSource.findOne(this.entityName, filter as any);`);
    lines.push('    debug("data %j", data);');
    lines.push('');
    if (afterReadEntries.length > 0) {
      lines.push(`    if (data) {`);
      emitLifecycleInline(afterReadEntries, lines, { instances: '[data]' }, mixinNames, mixinOptionsMap);
      lines.push(`    }`);
      lines.push('');
    }
    lines.push(`    return data ? new ${className}(data) : null;`);
    lines.push('  }');

    // findById
    lines.push('');
    lines.push(`  static async findById(`);
    lines.push(`    id: ${idType},`);
    lines.push(`    filter?: ${className}ObjectFilter,`);
    lines.push(`  ): Promise<${className}> {`);
    lines.push('    const debug = Debug.extend("findById");');
    lines.push('    debug("id %j", id);');
    lines.push('');
    lines.push(`    const data = await this.dataSource.findById(this.entityName, id, filter as any);`);
    lines.push('    debug("data %j", data);');
    lines.push('');
    lines.push(`    if (!data) throw new Error(\`${className} not found: \${id}\`);`);
    if (afterReadEntries.length > 0) {
      emitLifecycleInline(afterReadEntries, lines, { instances: '[data]' }, mixinNames, mixinOptionsMap);
      lines.push('');
    }
    lines.push(`    return new ${className}(data);`);
    lines.push('  }');

    // count
    lines.push('');
    lines.push(`  static async count(where?: ${className}WhereFilter): Promise<number> {`);
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

    if (!isView) {
      // findOrCreate
      lines.push('');
      lines.push(`  static async findOrCreate(options: {`);
      lines.push(`    where: ${className}WhereFilter;`);
      lines.push(`    create: Omit<${dataTypeName}, "${idName}">;`);
      lines.push(`  }): Promise<{ entity: ${className}; created: boolean }> {`);
      lines.push('    const debug = Debug.extend("findOrCreate");');
      lines.push('    debug("options.where %j", options.where);');
      lines.push('');
      lines.push(`    const result = await this.dataSource.findOrCreate(`);
      lines.push(`      this.entityName,`);
      lines.push(`      options as any,`);
      lines.push(`    );`);
      lines.push('    debug("result.created %j", result.created);');
      lines.push('');
      lines.push(`    return { entity: new ${className}(result.entity), created: result.created };`);
      lines.push('  }');

      // create
      lines.push('');
      lines.push(`  static async create(data: Omit<${dataTypeName}, "${idName}">): Promise<${className}> {`);
      lines.push('    const debug = Debug.extend("create");');
      lines.push('    debug("data %j", data);');
      lines.push('');
      // Inline Before Create lifecycle behaviors
      emitLifecycleInline(beforeCreateEntries, lines, { dataItems: '[data]' }, mixinNames, mixinOptionsMap);
      lines.push(`    const created = await this.dataSource.create(this.entityName, data);`);
      lines.push('    debug("created %j", created);');
      lines.push('');
      // Inline After Create lifecycle behaviors
      emitLifecycleInline(afterCreateEntries, lines, { instances: '[created]' }, mixinNames, mixinOptionsMap);
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
      emitLifecycleInline(beforeCreateEntries, lines, { dataItems: 'data' }, mixinNames, mixinOptionsMap);
      lines.push(`    const results = await this.dataSource.createMany(this.entityName, data);`);
      lines.push('    debug("results.length %j", results.length);');
      lines.push('');
      // Inline After Create lifecycle behaviors
      emitLifecycleInline(afterCreateEntries, lines, { instances: 'results' }, mixinNames, mixinOptionsMap);
      lines.push(`    return results.map((item: ${dataTypeName}) => new ${className}(item));`);
      lines.push('  }');

      // update
      lines.push('');
      lines.push(`  static async update(`);
      lines.push(`    filter: { where: ${className}WhereFilter; limit?: number },`);
      lines.push(`    data: Partial<${dataTypeName}>,`);
      lines.push(`  ): Promise<${className}[]> {`);
      lines.push('    const debug = Debug.extend("update");');
      lines.push('    debug("filter %j", filter);');
      lines.push('    debug("data %j", data);');
      lines.push('');
      // Inline Before Update lifecycle behaviors
      emitLifecycleInline(beforeUpdateEntries, lines, { where: 'filter.where', updates: 'data' }, mixinNames, mixinOptionsMap);
      lines.push(`    const results = await this.dataSource.update(`);
      lines.push(`      this.entityName,`);
      lines.push(`      filter as any,`);
      lines.push(`      data,`);
      lines.push(`    );`);
      lines.push('    debug("results.length %j", results.length);');
      lines.push('');
      // Inline After Update lifecycle behaviors
      emitLifecycleInline(afterUpdateEntries, lines, { instances: 'results' }, mixinNames, mixinOptionsMap);
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
      emitLifecycleInline(beforeUpdateEntries, lines, { where: '{ id }', updates: 'data' }, mixinNames, mixinOptionsMap);
      lines.push(`    const updated = await this.dataSource.updateById(`);
      lines.push(`      this.entityName,`);
      lines.push(`      id,`);
      lines.push(`      data,`);
      lines.push(`    );`);
      lines.push('    debug("updated %j", updated);');
      lines.push('');
      lines.push(`    if (!updated) throw new Error(\`${className} not found: \${id}\`);`);
      // Inline After Update lifecycle behaviors
      emitLifecycleInline(afterUpdateEntries, lines, { instances: '[updated]' }, mixinNames, mixinOptionsMap);
      lines.push(`    return new ${className}(updated);`);
      lines.push('  }');

      // upsert
      lines.push('');
      lines.push(`  static async upsert(options: {`);
      lines.push(`    where: ${className}WhereFilter;`);
      lines.push(`    create: Omit<${dataTypeName}, "${idName}">;`);
      lines.push(`    update: Partial<${dataTypeName}>;`);
      lines.push(`  }): Promise<${className}> {`);
      lines.push('    const debug = Debug.extend("upsert");');
      lines.push('    debug("options.where %j", options.where);');
      lines.push('');
      lines.push(`    const result = await this.dataSource.upsert(this.entityName, options as any);`);
      lines.push('    debug("result %j", result);');
      lines.push('');
      lines.push(`    return new ${className}(result);`);
      lines.push('  }');

      // delete
      lines.push('');
      lines.push(`  static async delete(filter: { where: ${className}WhereFilter; limit?: number }): Promise<number> {`);
      lines.push('    const debug = Debug.extend("delete");');
      lines.push('    debug("filter %j", filter);');
      lines.push('');
      // Inline Before Delete lifecycle behaviors
      emitLifecycleInline(beforeDeleteEntries, lines, { where: 'filter.where' }, mixinNames, mixinOptionsMap);
      // Pre-fetch instances for After Delete (if needed)
      if (afterDeleteEntries.length > 0) {
        lines.push(`    const deletedInstances = await this.find({ where: filter.where });`);
      }
      lines.push(`    const result = await this.dataSource.delete(this.entityName, filter as any);`);
      lines.push('    debug("result %j", result);');
      lines.push('');
      // Inline After Delete lifecycle behaviors
      emitLifecycleInline(afterDeleteEntries, lines, { instances: 'deletedInstances' }, mixinNames, mixinOptionsMap);
      lines.push('    return result;');
      lines.push('  }');

      // deleteById
      lines.push('');
      lines.push(`  static async deleteById(id: ${idType}): Promise<boolean> {`);
      lines.push('    const debug = Debug.extend("deleteById");');
      lines.push('    debug("id %j", id);');
      lines.push('');
      // Inline Before Delete lifecycle behaviors
      emitLifecycleInline(beforeDeleteEntries, lines, { where: '{ id }' }, mixinNames, mixinOptionsMap);
      // Pre-fetch instance for After Delete (if needed)
      if (afterDeleteEntries.length > 0) {
        lines.push(`    const deletedInstance = await this.findById(id);`);
      }
      lines.push(`    const result = await this.dataSource.deleteById(this.entityName, id);`);
      lines.push('    debug("result %j", result);');
      lines.push('');
      // Inline After Delete lifecycle behaviors
      emitLifecycleInline(afterDeleteEntries, lines, { instances: '[deletedInstance]' }, mixinNames, mixinOptionsMap);
      lines.push('    return result;');
      lines.push('  }');
    } // end if (!isView)

    // --- Instance and Class behaviors ---
    debug('total behaviors in project %j', allBehaviors.length);

    const behaviorMethods: string[] = [];

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
        const isAsync = func.isAsync;

        // Get parameters: skip first for instance behaviors (it's the instance itself)
        const params = func.parameters || [];
        const methodParams = isInstance ? params.slice(1) : params;
        const instanceParamName = isInstance && params.length > 0 ? params[0].name : undefined;

        // Get the function body from the AST (unchanged)
        const body = getBehaviorBody(behavior.sourceFile);
        if (body === undefined) {
          debug('no body found for behavior %j', func.name);
          continue;
        }

        // Build parameter string
        const paramStr = methodParams
          .map(p => {
            const optional = p.isOptional ? '?' : '';
            // Resolve Header<T> to inner type T
            let type = p.type || 'any';
            const headerMatch = type.match(/^Header<(.+)>$/);
            if (headerMatch) type = headerMatch[1];
            return `${p.name}${optional}: ${type}`;
          })
          .join(', ');

        // Build method
        const asyncPrefix = isAsync ? 'async ' : '';
        const staticPrefix = isInstance ? '' : 'static ';
        const returnType = func.returnType ? `: ${func.returnType}` : '';

        const methodLines: string[] = [];
        methodLines.push('');
        methodLines.push(`  ${staticPrefix}${asyncPrefix}${func.name}(${paramStr})${returnType} {`);

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
