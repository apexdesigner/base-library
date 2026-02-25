import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:testData');

/**
 * Extract the second argument (defaults object literal) from a setTestData() call.
 * Returns the class name and the raw object literal text.
 */
function getSetTestData(sourceFile: DesignMetadata['sourceFile']): { className: string; defaults: string } | undefined {
  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;

    const expr = statement.getExpression();
    if (!Node.isCallExpression(expr)) continue;

    const callee = expr.getExpression();
    if (!Node.isIdentifier(callee)) continue;
    if (callee.getText() !== 'setTestData') continue;

    const args = expr.getArguments();
    if (args.length < 2) continue;

    return {
      className: args[0].getText(),
      defaults: args[1].getText(),
    };
  }
  return undefined;
}

const testDataGenerator: DesignGenerator = {
  name: 'test-data',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['server/src/create-test-data.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const allBOs = context.listMetadata('BusinessObject').filter(m => !isLibrary(m));
    debug('total BOs: %d', allBOs.length);

    const entries: { className: string; defaults: string }[] = [];

    for (const bo of allBOs) {
      const testData = getSetTestData(bo.sourceFile);
      if (testData) {
        entries.push(testData);
        debug('found setTestData for %s', testData.className);
      }
    }

    if (entries.length === 0) {
      debug('no setTestData calls found');
      return '';
    }

    // Sort alphabetically by class name
    entries.sort((a, b) => a.className.localeCompare(b.className));

    const lines: string[] = [];

    // Imports
    for (const entry of entries) {
      lines.push(`import { ${entry.className} } from "./business-objects/${kebabCase(entry.className)}.js";`);
    }
    lines.push('');

    // Defaults map
    lines.push('const defaults: Record<string, Record<string, any>> = {');
    for (const entry of entries) {
      lines.push(`  ${entry.className}: ${entry.defaults},`);
    }
    lines.push('};');
    lines.push('');

    // createTestData function
    lines.push('export async function createTestData(model: any, overrides?: Record<string, any>): Promise<any> {');
    lines.push('  const entityName = model.entityName;');
    lines.push('  const data = { ...defaults[entityName], ...overrides };');
    lines.push('  return model.create(data);');
    lines.push('}');

    return lines.join('\n');
  },
};

export { testDataGenerator };
