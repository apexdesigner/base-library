import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:boAfterStart');

// Modules to skip when mapping design imports
const SKIP_MODULES = new Set(['@apexdesigner/dsl', 'vitest', 'debug']);

/**
 * Extract the function body text from an addBehavior() call.
 */
function getBehaviorBody(sourceFile: DesignMetadata['sourceFile']): string | undefined {
  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;

    const expr = statement.getExpression();
    if (!Node.isCallExpression(expr)) continue;

    const callee = expr.getExpression();
    if (!Node.isIdentifier(callee)) continue;
    if (callee.getText() !== 'addBehavior') continue;

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

const boAfterStartGenerator: DesignGenerator = {
  name: 'bo-after-start',

  triggers: [
    {
      metadataType: 'Behavior',
      condition: metadata => {
        const options = getBehaviorOptions(metadata.sourceFile);
        return options?.type === 'After Start';
      }
    }
  ],

  outputs: (metadata: DesignMetadata) => {
    const parent = getBehaviorParent(metadata.sourceFile);
    const func = getBehaviorFunction(metadata.sourceFile);
    if (!parent || !func) return [];
    return [`server/src/business-objects/${kebabCase(parent)}.${kebabCase(func.name)}.ts`];
  },

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const options = getBehaviorOptions(metadata.sourceFile);
    if (options?.type !== 'After Start') {
      debug('not an After Start behavior, skipping');
      return '';
    }

    const parent = getBehaviorParent(metadata.sourceFile);
    const func = getBehaviorFunction(metadata.sourceFile);
    const body = getBehaviorBody(metadata.sourceFile);
    if (!parent || !func || !body) {
      debug('no parent, function name, or body found');
      return '';
    }

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

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

      // Handle default import
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport && moduleSpecifier !== '@business-objects') {
        defaultImports.set(moduleSpecifier, defaultImport.getText());
      }

      // Handle named imports
      for (const named of importDecl.getNamedImports()) {
        const name = named.getName();

        if (moduleSpecifier === '@business-objects') {
          // Co-located: resolve to ./ since output is in business-objects/
          const boModule = `./${kebabCase(name)}.js`;
          if (!namedImports.has(boModule)) namedImports.set(boModule, new Set());
          namedImports.get(boModule)!.add(name);
        } else {
          if (!namedImports.has(moduleSpecifier)) namedImports.set(moduleSpecifier, new Set());
          namedImports.get(moduleSpecifier)!.add(name);
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
    lines.push(`const Debug = createDebug("${debugNamespace}:${pascalCase(parent)}:${func.name}");`);
    lines.push('');

    // --- Exported function ---
    lines.push(`export async function ${func.name}() {`);
    lines.push(`  const debug = Debug.extend("${func.name}");`);

    for (const line of body.split('\n')) {
      lines.push(`  ${line}`);
    }

    lines.push('}');

    const content = lines.join('\n');
    debug('Generated lifecycle BO behavior file for %j', func.name);

    return content;
  }
};

export { boAfterStartGenerator };
