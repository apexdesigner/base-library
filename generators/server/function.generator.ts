import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getModuleLevelCall } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import { Node } from 'ts-morph';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:serverFunction');

// Modules to skip when mapping design imports
const SKIP_MODULES = new Set(['@apexdesigner/dsl', '@roles', 'vitest']);

/**
 * Extract the layer option from addFunction(options, fn).
 */
function getLayerOption(sourceFile: DesignMetadata['sourceFile']): string | undefined {
  const call = getModuleLevelCall(sourceFile, 'addFunction');
  if (!call) return undefined;

  const args = call.getArguments();
  if (args.length < 2) return undefined;

  const optionsArg = args[0];
  if (!optionsArg || !Node.isObjectLiteralExpression(optionsArg)) return undefined;

  const layerProp = optionsArg.getProperty('layer');
  if (!layerProp || !Node.isPropertyAssignment(layerProp)) return undefined;

  const init = layerProp.getInitializer();
  if (!init || !Node.isStringLiteral(init)) return undefined;

  return init.getLiteralValue();
}

/**
 * Server-side function generator
 *
 * Overrides the baseline function generator for server runtime files only.
 * Maps design-time import aliases (@business-objects, @interface-definitions, etc.)
 * to their correct server runtime paths.
 */
const serverFunctionGenerator: DesignGenerator = {
  name: 'server-function',

  triggers: [{ metadataType: 'Function' }],

  outputs: (metadata: DesignMetadata) => {
    const layer = getLayerOption(metadata.sourceFile);
    if (layer === 'Client') return [];
    return [`server/src/functions/${kebabCase(metadata.name)}.ts`];
  },

  async generate(metadata: DesignMetadata, _context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const layer = getLayerOption(metadata.sourceFile);
    if (layer === 'Client') return '';

    const slug = kebabCase(metadata.name);
    const sourceFile = metadata.sourceFile;

    // Collect imports with design-time alias mapping
    const defaultImports = new Map<string, string>();
    const namedImports = new Map<string, Set<string>>();

    for (const importDecl of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      if (SKIP_MODULES.has(moduleSpecifier)) continue;

      // Map design-time aliases to generated paths
      let mappedModule = moduleSpecifier;
      if (moduleSpecifier === '@interface-definitions') {
        mappedModule = '../interface-definitions/index.js';
      } else if (moduleSpecifier.startsWith('@server-node-modules/')) {
        mappedModule = moduleSpecifier.replace('@server-node-modules/', '');
      } else if (moduleSpecifier.startsWith('@server/')) {
        mappedModule = moduleSpecifier.replace('@server/', '../') + '.js';
      } else if (moduleSpecifier === '@app') {
        mappedModule = '../app.js';
      }

      // Handle default import
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport && moduleSpecifier !== '@business-objects' && moduleSpecifier !== '@functions') {
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
    for (const [module, name] of Array.from(defaultImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`import ${name} from "${module}";`);
    }

    for (const [module, names] of Array.from(namedImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const sortedNames = Array.from(names).sort();
      lines.push(`import { ${sortedNames.join(', ')} } from "${module}";`);
    }

    // --- Top-level statements (const, type, etc.) but not imports or addFunction/addTest ---
    for (const statement of sourceFile.getStatements()) {
      if (Node.isImportDeclaration(statement)) continue;

      if (Node.isExpressionStatement(statement)) {
        const expr = statement.getExpression();
        if (Node.isCallExpression(expr)) {
          const callee = expr.getExpression();
          const calleeName = callee.getText();
          if (calleeName === 'addFunction' || calleeName === 'addTest') {
            // Extract and export the inner function from addFunction
            if (calleeName === 'addFunction') {
              const args = expr.getArguments();
              const fnArg = args[args.length - 1];
              if (fnArg && Node.isFunctionExpression(fnArg)) {
                const jsDocs = statement.getJsDocs();
                for (const doc of jsDocs) {
                  lines.push(doc.print());
                }

                const asyncPrefix = fnArg.isAsync() ? 'async ' : '';
                const name = fnArg.getName() || metadata.name;
                const params = fnArg.getParameters();
                const returnTypeNode = fnArg.getReturnTypeNode();
                const returnType = returnTypeNode ? `: ${returnTypeNode.getText()}` : '';
                const paramStr = params.map(p => p.print()).join(', ');
                const body = fnArg.getBody().print();

                lines.push('');
                lines.push(`export ${asyncPrefix}function ${name}(${paramStr})${returnType} ${body}`);
              }
            }
            continue;
          }
        }
      }

      // Pass through other top-level statements
      lines.push('');
      lines.push(statement.print());
    }

    const content = lines.join('\n') + '\n';
    debug('Generated server function file for %j', slug);

    return content;
  }
};

export { serverFunctionGenerator };
