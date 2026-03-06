import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:clientInterceptor');

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

const clientInterceptorGenerator: DesignGenerator = {
  name: 'client-interceptor',

  triggers: [
    {
      metadataType: 'AppBehavior',
      condition: metadata => {
        const options = getBehaviorOptions(metadata.sourceFile);
        return options?.type === 'Interceptor';
      }
    }
  ],

  outputs: (metadata: DesignMetadata) => [`client/src/app/interceptors/${kebabCase(metadata.name)}.interceptor.ts`],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const func = getBehaviorFunction(metadata.sourceFile);
    const body = getAppBehaviorBody(metadata.sourceFile);
    if (!func || !body) {
      debug('no function or body found');
      return '';
    }

    const params = func.parameters || [];

    // Separate framework params (req, next) from service params
    const frameworkParams = params.slice(0, 2);
    const serviceParams = params.slice(2);

    // Collect imports from the design file
    const defaultImports = new Map<string, string>();
    const namedImports = new Map<string, Set<string>>();

    for (const importDecl of metadata.sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      if (SKIP_MODULES.has(moduleSpecifier)) continue;

      // Map @app to relative app-types path
      if (moduleSpecifier === '@app') {
        for (const named of importDecl.getNamedImports()) {
          const appTypesModule = `../types/${kebabCase(named.getName())}`;
          if (!namedImports.has(appTypesModule)) namedImports.set(appTypesModule, new Set());
          namedImports.get(appTypesModule)!.add(named.getName());
        }
        continue;
      }

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

    // Add HttpInterceptorFn import
    if (!namedImports.has('@angular/common/http')) namedImports.set('@angular/common/http', new Set());
    namedImports.get('@angular/common/http')!.add('HttpInterceptorFn');

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

    // Build framework param string
    const reqParam = frameworkParams[0];
    const nextParam = frameworkParams[1];
    const reqStr = reqParam?.type ? `${reqParam.name}: ${reqParam.type}` : (reqParam?.name ?? 'req');
    const nextStr = nextParam?.type ? `${nextParam.name}: ${nextParam.type}` : (nextParam?.name ?? 'next');

    // Exported interceptor function
    lines.push(`export const ${func.name}: HttpInterceptorFn = (${reqStr}, ${nextStr}) => {`);

    // Inject services
    for (const svc of serviceParams) {
      lines.push(`  const ${svc.name} = inject(${svc.type});`);
    }

    // Emit body
    for (const line of body.split('\n')) {
      lines.push(line);
    }

    lines.push('};');

    const content = lines.join('\n');
    debug('generated interceptor file for %j', func.name);

    return content;
  }
};

export { clientInterceptorGenerator };
