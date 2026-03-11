import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getModuleLevelCall } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import { Node } from 'ts-morph';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:functionTest');

// Modules to skip when collecting imports from function design files
const SKIP_MODULES = new Set(['@apexdesigner/dsl', '@roles', 'vitest']);

interface TestCase {
  name: string;
  body: string;
  isAsync: boolean;
  timeout?: number;
}

/**
 * Extract all addTest() calls from a source file.
 */
function getTestCases(sourceFile: DesignMetadata['sourceFile']): TestCase[] {
  const tests: TestCase[] = [];
  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;

    const expr = statement.getExpression();
    if (!Node.isCallExpression(expr)) continue;

    const callee = expr.getExpression();
    if (!Node.isIdentifier(callee)) continue;
    if (callee.getText() !== 'addTest') continue;

    const args = expr.getArguments();
    if (args.length < 2) continue;

    const nameArg = args[0];
    if (!Node.isStringLiteral(nameArg)) continue;
    const name = nameArg.getLiteralValue();

    const fnArg = args[1];
    if (Node.isFunctionExpression(fnArg) || Node.isArrowFunction(fnArg)) {
      const bodyNode = fnArg.getBody();
      if (!Node.isBlock(bodyNode)) continue;

      const text = bodyNode.getText();
      const testCase: TestCase = {
        name,
        body: text.slice(1, -1),
        isAsync: fnArg.isAsync()
      };

      // Extract options (3rd argument)
      const optionsArg = args[2];
      if (optionsArg && Node.isObjectLiteralExpression(optionsArg)) {
        const timeoutProp = optionsArg.getProperty('timeout');
        if (timeoutProp && Node.isPropertyAssignment(timeoutProp)) {
          const init = timeoutProp.getInitializer();
          if (init && Node.isNumericLiteral(init)) {
            testCase.timeout = Number(init.getLiteralValue());
          }
        }
      }

      tests.push(testCase);
    }
  }
  return tests;
}

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
 * Extract the function name from addFunction(options, function name(...) { ... }).
 */
function getFunctionName(sourceFile: DesignMetadata['sourceFile']): string | undefined {
  const call = getModuleLevelCall(sourceFile, 'addFunction');
  if (!call) return undefined;

  const args = call.getArguments();
  const fnArg = args[args.length - 1];
  if (fnArg && Node.isFunctionExpression(fnArg)) {
    return fnArg.getName();
  }
  return undefined;
}

const functionTestGenerator: DesignGenerator = {
  name: 'function-test',

  triggers: [{ metadataType: 'Function' }],

  outputs: (metadata: DesignMetadata) => {
    const layer = getLayerOption(metadata.sourceFile);
    if (layer === 'Client') return [];
    return [`server/src/functions/${kebabCase(metadata.name)}.test.ts`];
  },

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const layer = getLayerOption(metadata.sourceFile);
    if (layer === 'Client') return '';

    const slug = kebabCase(metadata.name);
    const funcName = getFunctionName(metadata.sourceFile) || metadata.name;

    const tests = getTestCases(metadata.sourceFile);
    if (tests.length === 0) {
      debug('no test cases found for %s', funcName);
      return `import { describe, it } from "vitest";\n\ndescribe("${funcName}", () => {\n  it.skip("no tests defined");\n});\n`;
    }

    // Collect imports
    const defaultImports = new Map<string, string>();
    const namedImports = new Map<string, Set<string>>();
    let needsDebug = false;

    for (const importDecl of metadata.sourceFile.getImportDeclarations()) {
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
          const fnModule = `./${kebabCase(name)}.js`;
          if (!namedImports.has(fnModule)) namedImports.set(fnModule, new Set());
          namedImports.get(fnModule)!.add(name);
        } else {
          if (!namedImports.has(mappedModule)) namedImports.set(mappedModule, new Set());
          namedImports.get(mappedModule)!.add(name);
        }
      }
    }

    // Check if any test body references debug
    for (const test of tests) {
      if (/\bdebug\b/.test(test.body)) {
        needsDebug = true;
      }
    }

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    const lines: string[] = [];

    // --- Imports ---
    lines.push('import { describe, it, expect } from "vitest";');

    if (needsDebug) {
      lines.push('import createDebug from "debug";');
    }

    // Default imports (sorted)
    for (const [module, name] of Array.from(defaultImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`import ${name} from "${module}";`);
    }

    // Named imports (sorted)
    for (const [module, names] of Array.from(namedImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const sortedNames = Array.from(names).sort();
      lines.push(`import { ${sortedNames.join(', ')} } from "${module}";`);
    }

    // Debug setup
    if (needsDebug) {
      lines.push('');
      lines.push(`const debug = createDebug("${debugNamespace}:Test:${funcName}");`);
    }

    lines.push('');

    // --- Main describe block ---
    lines.push(`describe("${funcName}", () => {`);

    for (const test of tests) {
      const asyncPrefix = test.isAsync ? 'async ' : '';
      const timeoutSuffix = test.timeout ? `, ${test.timeout}` : '';
      lines.push(`  it("${test.name}", ${asyncPrefix}() => {`);

      // Indent body
      for (const line of test.body.split('\n')) {
        lines.push(`  ${line}`);
      }

      lines.push(`  }${timeoutSuffix});`);
    }

    lines.push('});');

    return lines.join('\n');
  }
};

export { functionTestGenerator };
