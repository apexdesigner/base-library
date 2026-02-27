import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:appTest');

interface TestCase {
  name: string;
  body: string;
  isAsync: boolean;
}

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

    const fnArg = args[1];
    if (Node.isFunctionExpression(fnArg) || Node.isArrowFunction(fnArg)) {
      const bodyNode = fnArg.getBody();
      if (!Node.isBlock(bodyNode)) continue;

      const text = bodyNode.getText();
      tests.push({
        name: nameArg.getLiteralValue(),
        body: text.slice(1, -1),
        isAsync: fnArg.isAsync(),
      });
    }
  }
  return tests;
}

const appTestGenerator: DesignGenerator = {
  name: 'app-test',

  triggers: [
    {
      metadataType: 'AppBehavior',
      condition: (metadata) => {
        const options = getBehaviorOptions(metadata.sourceFile);
        return !!options && !options.lifecycleStage;
      },
    },
  ],

  outputs: () => ['server/src/app.test.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Collect all non-lifecycle app behaviors with tests
    const classBehaviors = context.listMetadata('AppBehavior').filter(behavior => {
      const options = getBehaviorOptions(behavior.sourceFile);
      return options && !options.lifecycleStage;
    });

    interface BehaviorGroup {
      funcName: string;
      tests: TestCase[];
    }

    const groups: BehaviorGroup[] = [];
    const boImports = new Set<string>();
    let needsDebug = false;

    for (const behavior of classBehaviors) {
      try {
        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        const tests = getTestCases(behavior.sourceFile);
        if (tests.length === 0) continue;

        groups.push({ funcName: func.name, tests });

        // Collect imports
        for (const importDecl of behavior.sourceFile.getImportDeclarations()) {
          const moduleSpec = importDecl.getModuleSpecifierValue();

          if (moduleSpec === '@business-objects') {
            for (const namedImport of importDecl.getNamedImports()) {
              boImports.add(namedImport.getName());
            }
          }
        }

        for (const test of tests) {
          if (/\bdebug\b/.test(test.body)) {
            needsDebug = true;
          }
        }
      } catch (err) {
        debug('error processing app behavior: %j', err);
      }
    }

    if (groups.length === 0) {
      debug('no app test cases found');
      return `import { describe, it } from "vitest";\n\ndescribe("App", () => {\n  it.skip("no tests defined");\n});\n`;
    }

    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    const lines: string[] = [];

    // --- Imports ---
    lines.push('import { describe, it, expect, afterEach } from "vitest";');

    if (needsDebug) {
      lines.push('import createDebug from "debug";');
    }

    lines.push('import { App } from "./app.js";');

    // BO imports (relative from server/src/)
    for (const name of Array.from(boImports).sort()) {
      lines.push(`import { ${name} } from "./business-objects/${kebabCase(name)}.js";`);
    }

    if (needsDebug) {
      lines.push('');
      lines.push(`const debug = createDebug("${debugNamespace}:Test:App");`);
    }

    lines.push('');

    lines.push('describe("App", () => {');
    lines.push('  afterEach(async () => {');
    lines.push('    for (const ds of Object.values(App.dataSources)) {');
    lines.push('      await ds.truncateAll();');
    lines.push('    }');
    lines.push('  });');

    for (const group of groups) {
      lines.push('');
      lines.push(`  describe("${group.funcName}", () => {`);

      for (const test of group.tests) {
        const asyncPrefix = test.isAsync ? 'async ' : '';
        lines.push(`    it("${test.name}", ${asyncPrefix}() => {`);

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

export { appTestGenerator };
