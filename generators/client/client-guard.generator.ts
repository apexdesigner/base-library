import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:clientGuard');

const SKIP_MODULES = new Set([
  '@apexdesigner/dsl',
  'vitest',
]);

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

const clientGuardGenerator: DesignGenerator = {
  name: 'client-guard',

  triggers: [
    {
      metadataType: 'AppBehavior',
      condition: (metadata) => {
        const options = getBehaviorOptions(metadata.sourceFile);
        return options?.type === 'Guard';
      },
    },
  ],

  outputs: (metadata: DesignMetadata) => [
    `client/src/app/guards/${kebabCase(metadata.name)}.guard.ts`,
  ],

  async generate(metadata: DesignMetadata, _context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const options = getBehaviorOptions(metadata.sourceFile);
    const func = getBehaviorFunction(metadata.sourceFile);
    const body = getAppBehaviorBody(metadata.sourceFile);
    if (!func || !body) {
      debug('no function or body found');
      return '';
    }

    const params = func.parameters || [];

    // Angular guard signatures provide specific framework types as arguments.
    // Everything else must be injected.
    const FRAMEWORK_TYPES = new Set([
      'ActivatedRouteSnapshot',
      'RouterStateSnapshot',
      'UrlTree',
    ]);

    const frameworkParams: typeof params = [];
    const serviceParams: typeof params = [];
    for (const param of params) {
      if (param.type && FRAMEWORK_TYPES.has(param.type)) {
        frameworkParams.push(param);
      } else {
        serviceParams.push(param);
      }
    }

    // Determine guard type
    const stage = options?.stage as string || 'Activate';
    const guardType = stage === 'Deactivate' ? 'CanDeactivateFn' : 'CanActivateFn';

    // Collect imports from the design file
    const defaultImports = new Map<string, string>();
    const namedImports = new Map<string, Set<string>>();

    for (const importDecl of metadata.sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      if (SKIP_MODULES.has(moduleSpecifier)) continue;

      // Map @services to relative service paths
      if (moduleSpecifier === '@services') {
        for (const named of importDecl.getNamedImports()) {
          const name = named.getName();
          const svcBaseName = name.replace(/Service$/, '');
          const svcFile = kebabCase(svcBaseName);
          const svcModule = `../services/${svcFile}/${svcFile}.service`;
          if (!namedImports.has(svcModule)) namedImports.set(svcModule, new Set());
          namedImports.get(svcModule)!.add(name);
        }
        continue;
      }

      // For @angular/router, skip framework types (we add the guard type ourselves)
      // but keep other imports like Router that the guard body may use
      if (moduleSpecifier === '@angular/router') {
        for (const named of importDecl.getNamedImports()) {
          const name = named.getName();
          if (!FRAMEWORK_TYPES.has(name)) {
            if (!namedImports.has(moduleSpecifier)) namedImports.set(moduleSpecifier, new Set());
            namedImports.get(moduleSpecifier)!.add(name);
          }
        }
        continue;
      }

      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport) {
        defaultImports.set(moduleSpecifier, defaultImport.getText());
      }

      for (const named of importDecl.getNamedImports()) {
        if (!namedImports.has(moduleSpecifier)) namedImports.set(moduleSpecifier, new Set());
        namedImports.get(moduleSpecifier)!.add(named.getName());
      }
    }

    // Add inject import if there are service params
    if (serviceParams.length > 0) {
      if (!namedImports.has('@angular/core')) namedImports.set('@angular/core', new Set());
      namedImports.get('@angular/core')!.add('inject');
    }

    // Add router imports
    if (!namedImports.has('@angular/router')) namedImports.set('@angular/router', new Set());
    namedImports.get('@angular/router')!.add(guardType);

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

    // Exported guard function
    lines.push(`export const ${func.name}: ${guardType} = (${frameworkParams.map(p => p.name).join(', ')}) => {`);

    // Inject services at the top
    for (const svc of serviceParams) {
      lines.push(`  const ${svc.name} = inject(${svc.type});`);
    }

    // Wrap body for async support
    if (func.isAsync) {
      lines.push(`  return (async () => {`);
      for (const line of body.split('\n')) {
        lines.push(`  ${line}`);
      }
      lines.push(`  })();`);
    } else {
      for (const line of body.split('\n')) {
        lines.push(line);
      }
    }

    lines.push('};');

    const content = lines.join('\n');
    debug('generated guard file for %j', func.name);

    return content;
  },
};

export { clientGuardGenerator };
