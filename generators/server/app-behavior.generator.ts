import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getBehaviorOptions } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:appBehavior');

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

/**
 * Extract the function name from an addAppBehavior() call.
 */
function getAppBehaviorFunctionName(sourceFile: DesignMetadata['sourceFile']): string | undefined {
  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;

    const expr = statement.getExpression();
    if (!Node.isCallExpression(expr)) continue;

    const callee = expr.getExpression();
    if (!Node.isIdentifier(callee)) continue;
    if (callee.getText() !== 'addAppBehavior') continue;

    for (const arg of expr.getArguments()) {
      if (Node.isFunctionExpression(arg)) {
        const name = arg.getName();
        if (name) return name;
      }
    }
  }
  return undefined;
}

const appBehaviorGenerator: DesignGenerator = {
  name: 'app-behavior',

  triggers: [
    {
      metadataType: 'AppBehavior',
      condition: (metadata) => !isLibrary(metadata),
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `server/src/app-behaviors/${kebabCase(metadata.name)}.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const options = getBehaviorOptions(metadata.sourceFile);
    debug('options %j', options);

    const functionName = getAppBehaviorFunctionName(metadata.sourceFile);
    const body = getAppBehaviorBody(metadata.sourceFile);
    if (!functionName || !body) {
      debug('no function name or body found');
      return '';
    }

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase(projectMeta?.name || 'App');

    // Map design imports to generated server imports
    const importLines: string[] = [];
    importLines.push('import createDebug from "debug";');

    for (const importDecl of metadata.sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const namedImports = importDecl.getNamedImports().map(n => n.getText());
      if (namedImports.length === 0) continue;

      // Skip DSL imports
      if (moduleSpecifier === '@apexdesigner/dsl') continue;

      // Map @business-objects to generated server paths
      if (moduleSpecifier === '@business-objects') {
        for (const named of namedImports) {
          const boKebab = kebabCase(named);
          importLines.push(`import { ${named} } from "../business-objects/${boKebab}.js";`);
        }
        continue;
      }

      // Pass through other imports
      importLines.push(`import { ${namedImports.join(', ')} } from "${moduleSpecifier}";`);
    }

    const lines: string[] = [];
    lines.push(importLines.join('\n'));
    lines.push('');
    lines.push(`const debug = createDebug("${debugNamespace}:AppBehavior:${functionName}");`);
    lines.push('');
    lines.push(`export async function ${functionName}() {`);

    // Add body lines
    for (const line of body.split('\n')) {
      lines.push(`${line}`);
    }

    lines.push('}');

    const content = lines.join('\n');
    debug('Generated app behavior file for %j', metadata.name);

    return content;
  }
};

export { appBehaviorGenerator };
