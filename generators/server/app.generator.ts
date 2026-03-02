import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:app');

// Modules to skip when mapping design imports
const SKIP_MODULES = new Set([
  '@apexdesigner/dsl',
  '@project',
  'vitest',
  'debug',
]);

/**
 * Extract the function name and body from an addAppTestFixture(fn) call.
 */
function getAppTestFixtureFunction(sourceFile: DesignMetadata['sourceFile']): { name: string; body: string; isAsync: boolean } | undefined {
  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;

    const expr = statement.getExpression();
    if (!Node.isCallExpression(expr)) continue;

    const callee = expr.getExpression();
    if (!Node.isIdentifier(callee)) continue;
    if (callee.getText() !== 'addAppTestFixture') continue;

    const args = expr.getArguments();
    if (args.length < 1) continue;

    const fnArg = args[0];
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

/**
 * Extract the function body text from an addAppBehavior() call.
 */
function getAppBehaviorBody(sourceFile: DesignMetadata['sourceFile']): string | undefined {
  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;

    const expr = statement.getExpression();
    if (!Node.isCallExpression(expr)) continue;

    const callee = expr.getExpression();
    if (!Node.isIdentifier(callee)) continue;
    if (callee.getText() !== 'addAppBehavior') continue;

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

const appGenerator: DesignGenerator = {
  name: 'app',

  triggers: [
    {
      metadataType: 'Project',
    },
    {
      metadataType: 'AppBehavior',
    },
    {
      metadataType: 'DataSource',
    },
    {
      metadataType: 'BusinessObject',
    },
    {
      metadataType: 'TestFixture',
    },
  ],

  outputs: () => ['server/src/app.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    // Collect data sources and business objects
    const dataSources = context.listMetadata('DataSource')
      .sort((a, b) => a.name.localeCompare(b.name));
    const businessObjects = context.listMetadata('BusinessObject')
      .sort((a, b) => a.name.localeCompare(b.name));
    debug('dataSources count %j, businessObjects count %j', dataSources.length, businessObjects.length);

    // Collect class app behaviors (exclude lifecycle)
    const classBehaviors = context.listMetadata('AppBehavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options && !options.lifecycleStage;
    }).sort((a, b) => a.name.localeCompare(b.name));
    debug('classBehaviors count %j', classBehaviors.length);

    // Collect imports from all class behavior design files
    // Key: "default:module" or "named:module:name" to deduplicate
    const defaultImports = new Map<string, string>(); // module → default import name
    const namedImports = new Map<string, Set<string>>(); // module → set of named imports

    for (const behavior of classBehaviors) {
      for (const importDecl of behavior.sourceFile.getImportDeclarations()) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();

        if (SKIP_MODULES.has(moduleSpecifier)) continue;

        // Map @business-objects to relative paths
        const resolvedModule = moduleSpecifier === '@business-objects'
          ? null // handled per-named-import below
          : moduleSpecifier;

        // Handle default import
        const defaultImport = importDecl.getDefaultImport();
        if (defaultImport && resolvedModule) {
          defaultImports.set(resolvedModule, defaultImport.getText());
        }

        // Handle named imports
        for (const named of importDecl.getNamedImports()) {
          const name = named.getName();

          if (moduleSpecifier === '@business-objects') {
            const boModule = `./business-objects/${kebabCase(name)}.js`;
            if (!namedImports.has(boModule)) namedImports.set(boModule, new Set());
            namedImports.get(boModule)!.add(name);
          } else {
            if (!namedImports.has(moduleSpecifier)) namedImports.set(moduleSpecifier, new Set());
            namedImports.get(moduleSpecifier)!.add(name);
          }
        }
      }
    }

    // Collect app test fixtures
    const allFixtures = context.listMetadata('TestFixture');
    interface FixtureEntry { name: string; body: string; isAsync: boolean }
    const appFixtureEntries: FixtureEntry[] = [];

    for (const fixture of allFixtures) {
      try {
        const func = getAppTestFixtureFunction(fixture.sourceFile);
        if (!func) continue;

        appFixtureEntries.push(func);

        // Collect imports from fixture file
        for (const importDecl of fixture.sourceFile.getImportDeclarations()) {
          const moduleSpecifier = importDecl.getModuleSpecifierValue();

          if (SKIP_MODULES.has(moduleSpecifier)) continue;

          for (const named of importDecl.getNamedImports()) {
            const name = named.getName();

            if (moduleSpecifier === '@business-objects') {
              const boModule = `./business-objects/${kebabCase(name)}.js`;
              if (!namedImports.has(boModule)) namedImports.set(boModule, new Set());
              namedImports.get(boModule)!.add(name);
            }
          }
        }

        debug('collected app test fixture %j', func.name);
      } catch (err) {
        debug('error processing app test fixture: %j', err);
      }
    }

    const lines: string[] = [];

    // --- Imports ---
    lines.push('import createDebug from "debug";');

    // Data source import
    if (dataSources.length > 0) {
      lines.push('import { dataSource } from "./data-sources/index.js";');
    }

    // Business object imports
    for (const bo of businessObjects) {
      const boName = pascalCase(bo.name);
      const boModule = `./business-objects/${kebabCase(bo.name)}.js`;
      // Add to namedImports so behavior imports don't duplicate
      if (!namedImports.has(boModule)) namedImports.set(boModule, new Set());
      namedImports.get(boModule)!.add(boName);
    }

    // Default imports from external packages
    for (const [module, name] of Array.from(defaultImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`import ${name} from "${module}";`);
    }

    // Named imports
    for (const [module, names] of Array.from(namedImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const sortedNames = Array.from(names).sort();
      lines.push(`import { ${sortedNames.join(', ')} } from "${module}";`);
    }

    lines.push('');

    // --- Debug ---
    lines.push(`const Debug = createDebug("${debugNamespace}:App");`);
    lines.push('');

    // --- Class declaration ---
    lines.push('export class App {');

    // --- dataSources ---
    if (dataSources.length > 0) {
      lines.push('  static dataSources = { default: dataSource };');
      lines.push('');
    }

    // --- businessObjects (lazy getter to avoid circular import TDZ errors) ---
    if (businessObjects.length > 0) {
      lines.push('  static get businessObjects() {');
      lines.push('    return {');
      for (const bo of businessObjects) {
        lines.push(`      ${pascalCase(bo.name)},`);
      }
      lines.push('    };');
      lines.push('  }');
      lines.push('');
    }

    // --- Behavior methods ---
    const behaviorMethods: string[] = [];

    for (const behavior of classBehaviors) {
      try {
        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        const body = getAppBehaviorBody(behavior.sourceFile);
        if (!body) {
          debug('no body found for app behavior %j', func.name);
          continue;
        }

        const isAsync = func.isAsync;
        const params = func.parameters || [];
        const paramStr = params
          .map(p => {
            const optional = p.isOptional ? '?' : '';
            return `${p.name}${optional}: ${p.type || 'any'}`;
          })
          .join(', ');

        const asyncPrefix = isAsync ? 'async ' : '';

        const methodLines: string[] = [];
        methodLines.push('');
        methodLines.push(`  static ${asyncPrefix}${func.name}(${paramStr}) {`);
        methodLines.push(`    const debug = Debug.extend("${func.name}");`);

        // Add the body lines unchanged
        for (const line of body.split('\n')) {
          methodLines.push(`  ${line}`);
        }

        methodLines.push('  }');

        behaviorMethods.push(methodLines.join('\n'));
        debug('added app behavior method %j', func.name);
      } catch (err) {
        debug('error processing app behavior %j: %j', behavior.name, err);
      }
    }

    if (behaviorMethods.length > 0) {
      lines.push(behaviorMethods.join(''));
    }

    // --- Test fixtures ---
    if (appFixtureEntries.length > 0) {
      appFixtureEntries.sort((a, b) => a.name.localeCompare(b.name));
      lines.push('');
      lines.push('  static testFixtures = {');

      for (const fixture of appFixtureEntries) {
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
    debug('Generated app file');

    return content;
  },
};

export { appGenerator };
