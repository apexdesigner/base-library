import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:appLifecycleTest');

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

const appLifecycleTestGenerator: DesignGenerator = {
  name: 'app-lifecycle-test',

  triggers: [
    {
      metadataType: 'AppBehavior',
      condition: (metadata) => {
        if (isLibrary(metadata)) return false;
        const options = getBehaviorOptions(metadata.sourceFile);
        return !!options?.lifecycleStage;
      },
    },
  ],

  outputs: (metadata: DesignMetadata) => [
    `server/src/app-behaviors/${kebabCase(metadata.name)}.test.ts`,
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const func = getBehaviorFunction(metadata.sourceFile);
    if (!func) {
      debug('no function found for lifecycle behavior %j', metadata.name);
      return '';
    }

    const tests = getTestCases(metadata.sourceFile);
    if (tests.length === 0) {
      debug('no test cases for lifecycle behavior %j', metadata.name);
      return '';
    }

    const funcName = func.name;
    const funcKebab = kebabCase(metadata.name);
    debug('generating tests for lifecycle behavior %j (%s)', funcName, funcKebab);

    // Collect imports from the behavior file
    const boImports = new Set<string>();
    const projectImports = new Set<string>();
    let needsCreateTestData = false;
    let needsDebug = false;

    for (const importDecl of metadata.sourceFile.getImportDeclarations()) {
      const moduleSpec = importDecl.getModuleSpecifierValue();

      if (moduleSpec === '@business-objects') {
        for (const namedImport of importDecl.getNamedImports()) {
          boImports.add(namedImport.getName());
        }
      } else if (moduleSpec === '@apexdesigner/dsl') {
        for (const namedImport of importDecl.getNamedImports()) {
          if (namedImport.getName() === 'createTestData') {
            needsCreateTestData = true;
          }
        }
      } else if (moduleSpec === '@project') {
        for (const namedImport of importDecl.getNamedImports()) {
          projectImports.add(namedImport.getName());
        }
      }
    }

    for (const test of tests) {
      if (/\bdebug\b/.test(test.body)) {
        needsDebug = true;
      }
    }

    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    const lines: string[] = [];

    // --- Imports ---
    lines.push('import { describe, it, expect, afterEach } from "vitest";');

    if (needsDebug) {
      lines.push('import createDebug from "debug";');
    }

    if (needsCreateTestData) {
      lines.push('import { createTestData } from "../create-test-data.js";');
    }

    // Import the lifecycle function itself
    lines.push(`import { ${funcName} } from "./${funcKebab}.js";`);

    // BO imports (relative from server/src/app-behaviors/)
    for (const name of Array.from(boImports).sort()) {
      lines.push(`import { ${name} } from "../business-objects/${kebabCase(name)}.js";`);
    }

    // App / project imports
    for (const name of Array.from(projectImports).sort()) {
      lines.push(`import { ${name} } from "../app.js";`);
    }

    if (needsDebug) {
      lines.push('');
      lines.push(`const debug = createDebug("${debugNamespace}:Test:${funcName}");`);
    }

    lines.push('');

    // Pick a BO for afterEach truncateAll
    const truncateClass = boImports.size > 0
      ? Array.from(boImports).sort()[0]
      : null;

    lines.push(`describe("${funcName}", () => {`);

    if (truncateClass) {
      lines.push(`  afterEach(() => ${truncateClass}.dataSource.truncateAll());`);
    }

    for (const test of tests) {
      lines.push('');
      const asyncPrefix = test.isAsync ? 'async ' : '';
      lines.push(`  it("${test.name}", ${asyncPrefix}() => {`);

      for (const line of test.body.split('\n')) {
        lines.push(`  ${line}`);
      }

      lines.push('  });');
    }

    lines.push('});');

    return lines.join('\n');
  },
};

export { appLifecycleTestGenerator };
