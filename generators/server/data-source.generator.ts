import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getDataSource } from '@apexdesigner/generator';
import { getClassByBase } from '@apexdesigner/utilities';
import { SyntaxKind } from 'ts-morph';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:dataSource');

interface DataSourceInfo {
  name: string;
  className: string;
  persistenceType: string;
  factoryName: string;
  configOptions: string[];
  entityNames: string[];
  boKebabNames: string[];
}

function readDataSourceConfig(metadata: DesignMetadata, context: GenerationContext): DataSourceInfo {
  const dsName = metadata.name;
  const dsClass = getClassByBase(metadata.sourceFile, 'DataSource');
  if (!dsClass) {
    throw new Error(`DataSource "${dsName}" has no class extending DataSource`);
  }

  const configProp = dsClass.getProperty('configuration');
  const initializer = configProp?.getInitializer();
  const possibleValues = 'Postgres, Memory, File';
  if (!initializer || initializer.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    throw new Error(`DataSource "${dsName}" is missing a configuration object with persistenceType (possible values: ${possibleValues})`);
  }

  const objLiteral = initializer.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  let persistenceType = '';
  const configOptions: string[] = [];
  for (const prop of objLiteral.getProperties()) {
    if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;
    const propAssign = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
    const name = propAssign.getName();
    if (name === 'persistenceType') {
      persistenceType = propAssign.getInitializer()?.getText().replace(/['"]/g, '') || '';
    } else {
      configOptions.push(`${name}: ${propAssign.getInitializer()?.getText()}`);
    }
  }

  if (!persistenceType) {
    throw new Error(`DataSource "${dsName}" configuration is missing persistenceType (possible values: ${possibleValues})`);
  }

  // Find BOs that use this data source
  const businessObjects = context.listMetadata('BusinessObject');
  const myBOs = businessObjects.filter(bo => {
    const ds = getDataSource(bo.sourceFile, context);
    return ds && ds.name === dsName;
  });

  return {
    name: dsName,
    className: pascalCase(dsName),
    persistenceType,
    factoryName: `create${pascalCase(persistenceType)}Persistence`,
    configOptions,
    entityNames: myBOs.map(bo => pascalCase(bo.name)),
    boKebabNames: myBOs.map(bo => kebabCase(bo.name)),
  };
}

const dataSourceGenerator: DesignGenerator = {
  name: 'data-source',

  triggers: [
    {
      metadataType: 'DataSource',
      condition: (metadata) => !isLibrary(metadata),
    },
    {
      metadataType: 'BusinessObject',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['server/src/data-sources/index.ts'],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Collect all non-library data sources
    const allDataSources = context.listMetadata('DataSource').filter(ds => !isLibrary(ds));
    if (allDataSources.length === 0) return '';

    const dataSources = allDataSources.map(ds => readDataSourceConfig(ds, context));
    debug('data sources: %O', dataSources.map(ds => ({ name: ds.name, type: ds.persistenceType, entities: ds.entityNames })));

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    const isFederated = dataSources.length >= 2;

    if (isFederated) {
      return generateFederated(dataSources, debugNamespace, context);
    } else {
      return generateSingle(dataSources[0], debugNamespace);
    }
  }
};

function generateSingle(ds: DataSourceInfo, debugNamespace: string): string {
  const lines: string[] = [];

  lines.push('import createDebug from "debug";');
  lines.push(`import { ${ds.factoryName} } from "@apexdesigner/schema-persistence";`);

  for (const boKebab of ds.boKebabNames) {
    lines.push(`import "../schemas/business-objects/${boKebab}.js";`);
  }

  lines.push('');
  lines.push(`const debug = createDebug("${debugNamespace}:DataSource:${ds.className}");`);
  lines.push('');
  lines.push(`debug("Creating ${ds.persistenceType} persistence");`);
  const factoryArg = ds.configOptions.length > 0 ? `{ ${ds.configOptions.join(', ')} }` : '';
  lines.push(`export const dataSource = await ${ds.factoryName}(${factoryArg});`);
  lines.push(`debug("${ds.className} persistence created");`);
  lines.push('');
  lines.push('const result = await dataSource.validateSchema();');
  lines.push('if (!result.valid && result.autoFixable.length > 0) {');
  lines.push('  debug("Auto-fixing schema: %O", result.autoFixable);');
  lines.push('  await result.applyFixes();');
  lines.push('  debug("Schema fixes applied");');
  lines.push('}');

  return lines.join('\n');
}

function generateFederated(dataSources: DataSourceInfo[], debugNamespace: string, context: GenerationContext): string {
  const lines: string[] = [];

  // Collect all unique factory imports
  const factoryImports = new Set<string>();
  factoryImports.add('createFederatedPersistence');
  for (const ds of dataSources) {
    factoryImports.add(ds.factoryName);
  }

  lines.push('import createDebug from "debug";');
  lines.push(`import { ${[...factoryImports].join(', ')} } from "@apexdesigner/schema-persistence";`);
  lines.push('import { schemaRegistry } from "@apexdesigner/schema-tools";');

  // Schema side-effect imports for all BOs across all data sources
  for (const ds of dataSources) {
    for (const boKebab of ds.boKebabNames) {
      lines.push(`import "../schemas/business-objects/${boKebab}.js";`);
    }
  }

  lines.push('');
  lines.push(`const debug = createDebug("${debugNamespace}:DataSource:Federated");`);
  lines.push('');

  // Create each child persistence with entities
  for (const ds of dataSources) {
    const varName = camelCase(ds.name);
    const entitiesArg = `entities: [${ds.entityNames.map(n => `"${n}"`).join(', ')}]`;
    const allArgs = [...ds.configOptions, entitiesArg];
    lines.push(`debug("Creating ${ds.persistenceType} persistence for ${ds.className}");`);
    lines.push(`const ${varName} = await ${ds.factoryName}({ ${allArgs.join(', ')} });`);
  }

  lines.push('');

  // Validate each child's schema
  for (const ds of dataSources) {
    const varName = camelCase(ds.name);
    lines.push(`const ${varName}Result = await ${varName}.validateSchema();`);
    lines.push(`if (!${varName}Result.valid && ${varName}Result.autoFixable.length > 0) {`);
    lines.push(`  debug("Auto-fixing ${ds.className} schema: %O", ${varName}Result.autoFixable);`);
    lines.push(`  await ${varName}Result.applyFixes();`);
    lines.push(`  debug("${ds.className} schema fixes applied");`);
    lines.push('}');
  }

  lines.push('');

  // Build schemas from registry
  lines.push('const schemas: Record<string, any> = {};');
  lines.push('for (const name of schemaRegistry.names()) {');
  lines.push('  schemas[name] = schemaRegistry.schema(name)!.zodType;');
  lines.push('}');
  lines.push('');

  // Determine default data source
  const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
  let defaultDsName = dataSources[0].name;
  if (projectMeta) {
    const projectClass = getClassByBase(projectMeta.sourceFile, 'Project');
    if (projectClass) {
      const defaultDsProp = projectClass.getProperty('defaultDataSource');
      if (defaultDsProp) {
        const initText = defaultDsProp.getInitializer()?.getText();
        if (initText) {
          const matched = dataSources.find(ds => ds.className === initText);
          if (matched) defaultDsName = matched.name;
        }
      }
    }
  }

  // Create federated persistence
  lines.push('debug("Creating federated persistence");');
  lines.push('export const dataSource = createFederatedPersistence(schemas, {');
  lines.push('  dataSources: {');
  for (const ds of dataSources) {
    lines.push(`    ${camelCase(ds.name)},`);
  }
  lines.push('  },');
  lines.push(`  defaultDataSource: "${camelCase(defaultDsName)}",`);
  lines.push('});');
  lines.push('debug("Federated persistence created");');

  return lines.join('\n');
}

export { dataSourceGenerator };
