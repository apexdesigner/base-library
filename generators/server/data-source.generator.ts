import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getDataSource } from '@apexdesigner/generator';
import { getClassByBase } from '@apexdesigner/utilities';
import { SyntaxKind } from 'ts-morph';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:dataSource');

const dataSourceGenerator: DesignGenerator = {
  name: 'data-source',

  triggers: [
    {
      metadataType: 'DataSource',
      condition: (metadata) => !isLibrary(metadata),
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `server/src/data-sources/${kebabCase(metadata.name)}.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);

    const dsName = metadata.name;
    const dsClassName = pascalCase(dsName);

    // 1. Read persistenceType from configuration via AST
    const dsClass = getClassByBase(metadata.sourceFile, 'DataSource');
    if (!dsClass) {
      debug('No DataSource class found');
      return '';
    }

    const configProp = dsClass.getProperty('configuration');
    const initializer = configProp?.getInitializer();
    if (!initializer || initializer.getKind() !== SyntaxKind.ObjectLiteralExpression) {
      debug('No configuration object found');
      return '';
    }

    const objLiteral = initializer.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

    let persistenceType = '';
    for (const prop of objLiteral.getProperties()) {
      if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;
      const propAssign = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
      if (propAssign.getName() === 'persistenceType') {
        persistenceType = propAssign.getInitializer()?.getText().replace(/['"]/g, '') || '';
      }
    }

    if (!persistenceType) {
      debug('No persistenceType found, skipping');
      return '';
    }

    debug('persistenceType %j', persistenceType);

    // 2. Find all BusinessObjects that use this data source
    const businessObjects = context.listMetadata('BusinessObject');
    const myBOs = businessObjects.filter(bo => {
      const ds = getDataSource(bo.sourceFile, context);
      return ds && ds.name === dsName;
    });
    debug('found %d business objects for this data source', myBOs.length);

    // 3. Get project name for debug namespace
    const projectMeta = context.listMetadata('Project')[0];
    const debugNamespace = pascalCase(projectMeta?.name || 'App');

    // 4. Generate output
    const factoryName = `create${pascalCase(persistenceType)}Persistence`;
    const lines: string[] = [];

    lines.push('import createDebug from "debug";');
    lines.push(`import { ${factoryName} } from "@apexdesigner/schema-persistence";`);

    // Schema side-effect imports for BOs using this data source
    for (const bo of myBOs) {
      const boKebab = kebabCase(bo.name);
      lines.push(`import "../schemas/business-objects/${boKebab}.js";`);
    }

    lines.push('');
    lines.push(`const debug = createDebug("${debugNamespace}:DataSource:${dsClassName}");`);
    lines.push('');
    lines.push(`debug("Creating ${persistenceType} persistence");`);
    lines.push(`export const dataSource = await ${factoryName}();`);
    lines.push(`debug("${dsClassName} persistence created");`);
    lines.push('');
    lines.push('const result = await dataSource.validateSchema();');
    lines.push('if (!result.valid && result.autoFixable.length > 0) {');
    lines.push('  debug("Auto-fixing schema: %O", result.autoFixable);');
    lines.push('  await result.applyFixes();');
    lines.push('  debug("Schema fixes applied");');
    lines.push('}');

    const content = lines.join('\n');
    debug('Generated data source file for %j', dsName);

    return content;
  }
};

export { dataSourceGenerator };
