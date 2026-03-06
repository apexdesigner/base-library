import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:appLifecycle');

// Modules to skip when mapping design imports
const SKIP_MODULES = new Set(['@apexdesigner/dsl', '@roles', 'vitest', 'debug']);

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

const appLifecycleGenerator: DesignGenerator = {
  name: 'app-lifecycle',

  triggers: [
    {
      metadataType: 'AppBehavior',
      condition: metadata => {
        const options = getBehaviorOptions(metadata.sourceFile);
        return options?.type === 'Lifecycle Behavior' || options?.type === 'Middleware';
      }
    }
  ],

  outputs: (metadata: DesignMetadata) => [`server/src/app-behaviors/${kebabCase(metadata.name)}.ts`],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const options = getBehaviorOptions(metadata.sourceFile);
    if (options?.type !== 'Lifecycle Behavior' && options?.type !== 'Middleware') {
      debug('not a lifecycle/middleware behavior, skipping');
      return '';
    }

    const func = getBehaviorFunction(metadata.sourceFile);
    const body = getAppBehaviorBody(metadata.sourceFile);
    if (!func || !body) {
      debug('no function name or body found');
      return '';
    }

    // Extract debug namespace from the design file's createDebug('...') call.
    // Falls back to a generated namespace if not found.
    let debugNamespace: string | undefined;
    for (const statement of metadata.sourceFile.getStatements()) {
      const text = statement.getText();
      const match = text.match(/createDebug\(['"]([^'"]+)['"]\)/);
      if (match) {
        debugNamespace = match[1];
        break;
      }
    }
    if (!debugNamespace) {
      const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
      debugNamespace = `${pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''))}:AppBehavior:${func.name}`;
    }

    // Collect imports from the design file
    const defaultImports = new Map<string, string>();
    const namedImports = new Map<string, Set<string>>();

    for (const importDecl of metadata.sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      if (SKIP_MODULES.has(moduleSpecifier)) continue;

      // Handle @app → App import
      if (moduleSpecifier === '@app') {
        const appModule = '../app.js';
        if (!namedImports.has(appModule)) namedImports.set(appModule, new Set());
        namedImports.get(appModule)!.add('App');
        continue;
      }

      // Map design-time aliases to generated paths
      let mappedModule = moduleSpecifier;
      if (moduleSpecifier.startsWith('@server-node-modules/')) {
        mappedModule = moduleSpecifier.replace('@server-node-modules/', '');
      } else if (moduleSpecifier.startsWith('@server/')) {
        mappedModule = moduleSpecifier.replace('@server/', '../') + '.js';
      } else if (moduleSpecifier === '@functions') {
        // Functions are per-named-import, handled below
        mappedModule = '@functions';
      }

      // Handle default import
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport && moduleSpecifier !== '@business-objects') {
        defaultImports.set(mappedModule, defaultImport.getText());
      }

      // Handle named imports
      for (const named of importDecl.getNamedImports()) {
        const name = named.getName();

        if (moduleSpecifier === '@business-objects') {
          const boModule = `../business-objects/${kebabCase(name)}.js`;
          if (!namedImports.has(boModule)) namedImports.set(boModule, new Set());
          namedImports.get(boModule)!.add(name);
        } else if (moduleSpecifier === '@functions') {
          const fnModule = `../functions/${kebabCase(name)}.js`;
          if (!namedImports.has(fnModule)) namedImports.set(fnModule, new Set());
          namedImports.get(fnModule)!.add(name);
        } else {
          if (!namedImports.has(mappedModule)) namedImports.set(mappedModule, new Set());
          namedImports.get(mappedModule)!.add(name);
        }
      }
    }

    const lines: string[] = [];

    // --- Imports ---
    lines.push('import createDebug from "debug";');

    for (const [module, name] of Array.from(defaultImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`import ${name} from "${module}";`);
    }

    for (const [module, names] of Array.from(namedImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const sortedNames = Array.from(names).sort();
      lines.push(`import { ${sortedNames.join(', ')} } from "${module}";`);
    }

    lines.push('');

    // --- Debug ---
    lines.push(`const Debug = createDebug("${debugNamespace}");`);
    lines.push('');

    // --- Exported function ---
    const params = func.parameters || [];
    const paramStr = params.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');
    lines.push(`export async function ${func.name}(${paramStr}) {`);
    lines.push(`  const debug = Debug.extend("${func.name}");`);

    for (const line of body.split('\n')) {
      lines.push(`  ${line}`);
    }

    lines.push('}');

    const content = lines.join('\n');
    debug('Generated lifecycle app behavior file for %j', func.name);

    return content;
  }
};

export { appLifecycleGenerator };
