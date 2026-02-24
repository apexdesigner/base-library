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
      condition: (metadata) => !isLibrary(metadata),
    },
    {
      metadataType: 'AppBehavior',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['server/src/app.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    // Collect class app behaviors (exclude lifecycle)
    const classBehaviors = context.listMetadata('AppBehavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options && !options.lifecycleStage;
    });
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

    const lines: string[] = [];

    // --- Imports ---
    lines.push('import createDebug from "debug";');

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

    // Close class
    lines.push('}');

    const content = lines.join('\n');
    debug('Generated app file');

    return content;
  },
};

export { appGenerator };
