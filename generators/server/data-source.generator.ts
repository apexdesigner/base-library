import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getDataSource } from '@apexdesigner/generator';
import { getClassByBase } from '@apexdesigner/utilities';
import { SyntaxKind } from 'ts-morph';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:dataSource');

interface DataSourceInfo {
  name: string;
  className: string;
  persistenceType: string;
  factoryName: string;
  configOptions: string[];
  functionImports: { name: string; kebab: string }[];
  entityNames: string[];
  boKebabNames: string[];
  isDefault: boolean;
}

function readDataSourceConfig(metadata: DesignMetadata, context: GenerationContext): DataSourceInfo | undefined {
  const dsName = metadata.name;
  const dsClass = getClassByBase(metadata.sourceFile, 'DataSource');
  if (!dsClass) {
    return undefined;
  }

  const configProp = dsClass.getProperty('configuration');
  const initializer = configProp?.getInitializer();
  if (!initializer || initializer.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    return undefined;
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
    return undefined;
  }

  // Collect function imports from @functions for Custom data sources
  const functionImports: { name: string; kebab: string }[] = [];
  if (persistenceType === 'Custom') {
    const functionImportDecls = metadata.sourceFile.getImportDeclarations().filter(imp => imp.getModuleSpecifierValue() === '@functions');
    for (const decl of functionImportDecls) {
      for (const named of decl.getNamedImports()) {
        functionImports.push({ name: named.getName(), kebab: kebabCase(named.getName()) });
      }
    }
  }

  // Find BOs that use this data source
  const businessObjects = context.listMetadata('BusinessObject');
  const myBOs = businessObjects.filter(bo => {
    const ds = getDataSource(bo.sourceFile, context);
    return ds && ds.name === dsName;
  });

  // Check for isDefault property
  const isDefaultProp = dsClass.getProperty('isDefault');
  const isDefault = isDefaultProp?.getInitializer()?.getText() === 'true';

  return {
    name: dsName,
    className: pascalCase(dsName),
    persistenceType,
    factoryName: `create${pascalCase(persistenceType)}Persistence`,
    configOptions,
    functionImports,
    entityNames: myBOs.map(bo => pascalCase(bo.name)).sort(),
    boKebabNames: myBOs.map(bo => kebabCase(bo.name)).sort(),
    isDefault
  };
}

const dataSourceGenerator: DesignGenerator = {
  name: 'data-source',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'DataSource'
    },
    {
      metadataType: 'BusinessObject'
    }
  ],

  outputs: () => ['server/src/data-sources/index.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Collect all data sources
    const allDataSources = context.listMetadata('DataSource');
    if (allDataSources.length === 0) return '';

    const dataSources = allDataSources.map(ds => readDataSourceConfig(ds, context)).filter((ds): ds is DataSourceInfo => ds !== undefined).sort((a, b) => a.name.localeCompare(b.name));
    debug(
      'data sources: %O',
      dataSources.map(ds => ({ name: ds.name, type: ds.persistenceType, entities: ds.entityNames }))
    );

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    const isFederated = dataSources.length >= 2;

    if (isFederated) {
      return generateFederated(dataSources, debugNamespace);
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

  // Function imports for Custom data sources
  for (const fn of ds.functionImports) {
    lines.push(`import { ${fn.name} } from "../functions/${fn.kebab}.js";`);
  }

  lines.push('');
  lines.push(`const debug = createDebug("${debugNamespace}:DataSource:${ds.className}");`);
  lines.push('');
  lines.push(`debug("Creating ${ds.persistenceType} persistence");`);
  if (ds.persistenceType === 'Postgres') {
    lines.push(
      'debug("PG env: PGHOST=%s PGPORT=%s PGDATABASE=%s PGUSER=%s DATABASE_URL=%s", process.env.PGHOST, process.env.PGPORT, process.env.PGDATABASE, process.env.PGUSER, process.env.DATABASE_URL ? "[set]" : undefined);'
    );
  }
  const factoryArg = ds.configOptions.length > 0 ? `{ ${ds.configOptions.join(', ')} }` : '';
  lines.push(`export const dataSource = await ${ds.factoryName}(${factoryArg});`);
  lines.push(`debug("${ds.className} persistence created");`);

  if (ds.persistenceType !== 'Custom') {
    lines.push('');
    lines.push('const schemaForceSync = process.env.SCHEMA_FORCE_SYNC === "true";');
    lines.push('const result = await dataSource.validateSchema();');
    lines.push('if (!result.valid) {');
    lines.push('  if (schemaForceSync) {');
    lines.push('    debug("Force-syncing schema");');
    lines.push('    const fixResult = await result.applyFixes({ force: true });');
    lines.push('    if (!fixResult.success) {');
    lines.push('      console.error("Schema fix errors:", fixResult.errors);');
    lines.push('      throw new Error("Schema force-sync failed");');
    lines.push('    }');
    lines.push('    if (fixResult.executedSql.length > 0) console.log("Schema fixes applied:", fixResult.executedSql);');
    lines.push('  } else {');
    lines.push('    if (result.autoFixable.length > 0) {');
    lines.push('      debug("Auto-fixing schema: %O", result.autoFixable.map((d: any) => d.fixMessage ?? d.message));');
    lines.push('      const fixResult = await result.applyFixes();');
    lines.push('      if (!fixResult.success) {');
    lines.push('        console.error("Schema fix errors:", fixResult.errors);');
    lines.push('        throw new Error("Schema auto-fix failed");');
    lines.push('      }');
    lines.push('      console.log("Schema fixes applied:", fixResult.executedSql);');
    lines.push('    }');
    lines.push('    const unfixable: string[] = [];');
    lines.push('    for (const [name, t] of Object.entries(result.tables) as any) {');
    lines.push('      for (const d of t.differences) if (!d.autoFixable) unfixable.push(`${name}: ${d.message}`);');
    lines.push('    }');
    lines.push('    for (const [name, v] of Object.entries(result.views) as any) {');
    lines.push('      for (const d of v.differences) if (!d.autoFixable) unfixable.push(`${name}: ${d.message}`);');
    lines.push('    }');
    lines.push('    if (unfixable.length > 0) {');
    lines.push('      console.error("Unfixable schema issues:", unfixable);');
    lines.push('      throw new Error("Schema validation failed with unfixable issues");');
    lines.push('    }');
    lines.push('  }');
    lines.push('}');
  } // end if not Custom

  return lines.join('\n');
}

function generateFederated(dataSources: DataSourceInfo[], debugNamespace: string): string {
  const lines: string[] = [];

  // Collect all unique factory imports
  const factoryImports = new Set<string>();
  factoryImports.add('createFederatedPersistence');
  for (const ds of dataSources) {
    factoryImports.add(ds.factoryName);
  }

  lines.push('import createDebug from "debug";');
  lines.push(`import { ${[...factoryImports].sort().join(', ')} } from "@apexdesigner/schema-persistence";`);
  lines.push('import { schemaRegistry } from "@apexdesigner/schema-tools";');

  // Schema side-effect imports for all BOs across all data sources
  for (const ds of dataSources) {
    for (const boKebab of ds.boKebabNames) {
      lines.push(`import "../schemas/business-objects/${boKebab}.js";`);
    }
  }

  // Function imports for Custom data sources
  for (const ds of dataSources) {
    for (const fn of ds.functionImports) {
      lines.push(`import { ${fn.name} } from "../functions/${fn.kebab}.js";`);
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
    if (ds.persistenceType === 'Postgres') {
      lines.push(
        'debug("PG env: PGHOST=%s PGPORT=%s PGDATABASE=%s PGUSER=%s DATABASE_URL=%s", process.env.PGHOST, process.env.PGPORT, process.env.PGDATABASE, process.env.PGUSER, process.env.DATABASE_URL ? "[set]" : undefined);'
      );
    }

    if (ds.persistenceType === 'Custom') {
      lines.push(`const ${varName} = ${ds.factoryName}({ ${allArgs.join(', ')} });`);
    } else {
      lines.push(`const ${varName} = await ${ds.factoryName}({ ${allArgs.join(', ')} });`);
    }
  }

  lines.push('');

  // Validate each child's schema (skip Custom — no tables to validate)
  const validatableDataSources = dataSources.filter(ds => ds.persistenceType !== 'Custom');
  if (validatableDataSources.length > 0) {
    lines.push('const schemaForceSync = process.env.SCHEMA_FORCE_SYNC === "true";');
  }
  for (const ds of validatableDataSources) {
    const varName = camelCase(ds.name);
    lines.push(`const ${varName}Result = await ${varName}.validateSchema();`);
    lines.push(`if (!${varName}Result.valid) {`);
    lines.push('  if (schemaForceSync) {');
    lines.push(`    debug("Force-syncing ${ds.className} schema");`);
    lines.push(`    const fixResult = await ${varName}Result.applyFixes({ force: true });`);
    lines.push('    if (!fixResult.success) {');
    lines.push(`      console.error("${ds.className} schema fix errors:", fixResult.errors);`);
    lines.push(`      throw new Error("Schema force-sync failed for ${ds.className}");`);
    lines.push('    }');
    lines.push(`    if (fixResult.executedSql.length > 0) console.log("${ds.className} schema fixes applied:", fixResult.executedSql);`);
    lines.push('  } else {');
    lines.push(`    if (${varName}Result.autoFixable.length > 0) {`);
    lines.push(`      debug("Auto-fixing ${ds.className} schema: %O", ${varName}Result.autoFixable.map((d: any) => d.fixMessage ?? d.message));`);
    lines.push(`      const fixResult = await ${varName}Result.applyFixes();`);
    lines.push('      if (!fixResult.success) {');
    lines.push(`        console.error("${ds.className} schema fix errors:", fixResult.errors);`);
    lines.push(`        throw new Error("Schema auto-fix failed for ${ds.className}");`);
    lines.push('      }');
    lines.push(`      console.log("${ds.className} schema fixes applied:", fixResult.executedSql);`);
    lines.push('    }');
    lines.push('    const unfixable: string[] = [];');
    lines.push(`    for (const [name, t] of Object.entries(${varName}Result.tables) as any) {`);
    lines.push('      for (const d of t.differences) if (!d.autoFixable) unfixable.push(`${name}: ${d.message}`);');
    lines.push('    }');
    lines.push(`    for (const [name, v] of Object.entries(${varName}Result.views) as any) {`);
    lines.push('      for (const d of v.differences) if (!d.autoFixable) unfixable.push(`${name}: ${d.message}`);');
    lines.push('    }');
    lines.push('    if (unfixable.length > 0) {');
    lines.push(`      console.error("Unfixable schema issues for ${ds.className}:", unfixable);`);
    lines.push(`      throw new Error("Schema validation failed for ${ds.className} with unfixable issues");`);
    lines.push('    }');
    lines.push('  }');
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
  // Priority: isDefault on DataSource > first data source alphabetically
  const defaultDs = dataSources.find(ds => ds.isDefault);
  let defaultDsName = defaultDs ? defaultDs.name : dataSources[0].name;

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
