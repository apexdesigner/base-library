import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, resolveMixins } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:businessObjectTest');

interface TestCase {
  name: string;
  body: string;
  isAsync: boolean;
}

/**
 * Extract all addTest() calls from a source file.
 * Returns test name (string literal) and function body text (braces stripped).
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
      tests.push({
        name,
        body: text.slice(1, -1),
        isAsync: fnArg.isAsync(),
      });
    }
  }
  return tests;
}

const businessObjectTestGenerator: DesignGenerator = {
  name: 'business-object-test',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata) => !isLibrary(metadata),
    },
    {
      metadataType: 'Behavior',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: (metadata: DesignMetadata) => {
    const name = getBehaviorParent(metadata.sourceFile) || metadata.name;
    return [`server/src/business-objects/${kebabCase(name)}.test.ts`];
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

    const className = pascalCase(metadata.name);
    debug('generating tests for %j', className);

    // Resolve mixins
    const mixins = resolveMixins(metadata.sourceFile, context);
    const mixinNames = mixins.map(m => m.name);
    const parentNames = new Set([className, ...mixinNames]);

    const allBehaviors = context.listMetadata('Behavior');

    // Collect behavior groups with tests
    interface BehaviorGroup {
      funcName: string;
      tests: TestCase[];
    }

    const groups: BehaviorGroup[] = [];
    const boImports = new Set<string>();
    const projectImports = new Set<string>();
    let needsDebug = false;

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const parent = getBehaviorParent(behavior.sourceFile);
        if (!parentNames.has(parent)) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        const tests = getTestCases(behavior.sourceFile);
        if (tests.length === 0) continue;

        groups.push({ funcName: func.name, tests });

        // Collect imports from this behavior file
        for (const importDecl of behavior.sourceFile.getImportDeclarations()) {
          const moduleSpec = importDecl.getModuleSpecifierValue();

          if (moduleSpec === '@business-objects') {
            for (const namedImport of importDecl.getNamedImports()) {
              boImports.add(namedImport.getName());
            }
          } else if (moduleSpec === '@project') {
            for (const namedImport of importDecl.getNamedImports()) {
              projectImports.add(namedImport.getName());
            }
          }
        }

        // Check if any test body references debug
        for (const test of tests) {
          if (/\bdebug\b/.test(test.body)) {
            needsDebug = true;
          }
        }
      } catch (err) {
        debug('error processing behavior: %j', err);
      }
    }

    if (groups.length === 0) {
      debug('no test cases found for %s', className);
      return undefined;
    }

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    const lines: string[] = [];

    // --- Imports ---
    lines.push('import { describe, it, expect, afterEach } from "vitest";');

    if (needsDebug) {
      lines.push('import createDebug from "debug";');
    }

    // BO imports (sorted)
    for (const name of Array.from(boImports).sort()) {
      lines.push(`import { ${name} } from "./${kebabCase(name)}.js";`);
    }

    // App / project imports
    for (const name of Array.from(projectImports).sort()) {
      lines.push(`import { ${name} } from "../app.js";`);
    }

    // Debug setup
    if (needsDebug) {
      lines.push('');
      lines.push(`const debug = createDebug("${debugNamespace}:Test:${className}");`);
    }

    lines.push('');

    // --- Main describe block ---
    lines.push(`describe("${className}", () => {`);
    lines.push(`  afterEach(() => ${className}.dataSource.truncateAll());`);

    // Generate describe/it blocks per behavior
    for (const group of groups) {
      lines.push('');
      lines.push(`  describe("${group.funcName}", () => {`);

      for (const test of group.tests) {
        const asyncPrefix = test.isAsync ? 'async ' : '';
        lines.push(`    it("${test.name}", ${asyncPrefix}() => {`);

        // Indent body
        for (const line of test.body.split('\n')) {
          lines.push(`    ${line}`);
        }

        lines.push('    });');
      }

      lines.push('  });');
    }

    lines.push('});');

    return lines.join('\n');
  },
};

export { businessObjectTestGenerator };
