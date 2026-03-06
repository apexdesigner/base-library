import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:clientProvider');

const SKIP_MODULES = new Set(['@apexdesigner/dsl', 'vitest']);

/**
 * Collect top-level statements that aren't imports or the addAppBehavior() call.
 */
function getTopLevelStatements(sourceFile: DesignMetadata['sourceFile']): string[] {
  const results: string[] = [];
  for (const statement of sourceFile.getStatements()) {
    if (Node.isImportDeclaration(statement)) continue;
    if (Node.isExpressionStatement(statement)) {
      const expr = statement.getExpression();
      if (Node.isCallExpression(expr)) {
        const callee = expr.getExpression();
        if (Node.isIdentifier(callee) && callee.getText() === 'addAppBehavior') continue;
      }
    }
    results.push(statement.getText());
  }
  return results;
}

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

const clientProviderGenerator: DesignGenerator = {
  name: 'client-provider',

  triggers: [
    {
      metadataType: 'AppBehavior',
      condition: metadata => {
        const options = getBehaviorOptions(metadata.sourceFile);
        return options?.type === 'Provider';
      }
    }
  ],

  outputs: (metadata: DesignMetadata) => [`client/src/app/providers/${kebabCase(metadata.name)}.ts`],

  async generate(metadata: DesignMetadata, _context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const func = getBehaviorFunction(metadata.sourceFile);
    const body = getAppBehaviorBody(metadata.sourceFile);
    if (!func || !body) {
      debug('no function or body found');
      return '';
    }

    // Collect imports from the design file
    const defaultImports = new Map<string, string>();
    const namedImports = new Map<string, Set<string>>();

    for (const importDecl of metadata.sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      if (SKIP_MODULES.has(moduleSpecifier)) continue;

      // Map @interface-definitions to relative path
      const resolvedModule = moduleSpecifier === '@interface-definitions' ? '../interface-definitions' : moduleSpecifier;

      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport) {
        defaultImports.set(resolvedModule, defaultImport.getText());
      }

      for (const named of importDecl.getNamedImports()) {
        if (!namedImports.has(resolvedModule)) namedImports.set(resolvedModule, new Set());
        const alias = named.getAliasNode()?.getText();
        const importText = alias ? `${named.getName()} as ${alias}` : named.getName();
        namedImports.get(resolvedModule)!.add(importText);
      }
    }

    // Collect top-level statements (e.g. const debug = createDebug("..."))
    const topLevelStatements = getTopLevelStatements(metadata.sourceFile);

    const lines: string[] = [];

    // Imports
    for (const [module, name] of Array.from(defaultImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`import ${name} from "${module}";`);
    }

    for (const [module, names] of Array.from(namedImports.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const sortedNames = Array.from(names).sort();
      lines.push(`import { ${sortedNames.join(', ')} } from "${module}";`);
    }

    lines.push('');

    // Top-level statements
    if (topLevelStatements.length > 0) {
      for (const stmt of topLevelStatements) {
        lines.push(stmt);
      }
      lines.push('');
    }

    // Return type from function
    const returnType = func.returnType || 'EnvironmentProviders';

    // Exported function
    lines.push(`export function ${func.name}(): ${returnType} {`);

    for (const line of body.split('\n')) {
      lines.push(line);
    }

    lines.push('}');

    const content = lines.join('\n');
    debug('generated provider file for %j', func.name);

    return content;
  }
};

export { clientProviderGenerator };
