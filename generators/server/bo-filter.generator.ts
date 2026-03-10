import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getDataSource, getIdProperty, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase, getModuleLevelCall } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import { Node } from 'ts-morph';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:boFilter');

interface ScalarProperty {
  name: string;
  tsType: string;
}

interface RelationshipInfo {
  name: string;
  relatedBoName: string;
  type: 'Belongs To' | 'Has Many' | 'Has One' | 'References';
}

/**
 * Resolve the TypeScript type for a property node, stripping nullable/optional.
 * Returns undefined for types that shouldn't appear in WhereFilter (Json, unknown, relationships).
 */
function resolvePropertyType(
  typeText: string,
  baseTypeValidValues: Map<string, string[]>,
  baseTypeNativeMap: Map<string, string>
): string | undefined {
  if (typeText === 'string') return 'string';
  if (typeText === 'number') return 'number';
  if (typeText === 'boolean') return 'boolean';
  if (typeText === 'Date' || typeText === 'DateTime') return 'Date';

  if (baseTypeValidValues.has(typeText)) {
    const values = baseTypeValidValues.get(typeText)!;
    return values.map(v => `'${v.replace(/'/g, "\\'")}'`).join(' | ');
  }

  if (baseTypeNativeMap.has(typeText)) {
    const native = baseTypeNativeMap.get(typeText)!;
    if (native === 'string') return 'string';
    if (native === 'number') return 'number';
    if (native === 'boolean') return 'boolean';
  }

  return undefined;
}

/**
 * Resolve the TypeScript type for an id or foreign key type string.
 */
function resolveIdOrFkType(typeStr: string, baseTypeNativeMap: Map<string, string>): string {
  if (typeStr === 'string' || typeStr === 'String') return 'string';
  if (typeStr === 'number' || typeStr === 'Number' || typeStr === 'Serial') return 'number';
  if (baseTypeNativeMap.has(typeStr)) {
    const native = baseTypeNativeMap.get(typeStr)!;
    if (native === 'string' || native === 'number') return native;
  }
  return 'string';
}

/**
 * Collect scalar properties from a class (BO or Mixin), skipping names in skipSet.
 */
function collectScalarProps(
  classNode: ReturnType<typeof getClassByBase>,
  skipSet: Set<string>,
  baseTypeValidValues: Map<string, string[]>,
  baseTypeNativeMap: Map<string, string>
): ScalarProperty[] {
  if (!classNode) return [];
  const result: ScalarProperty[] = [];

  for (const prop of classNode.getProperties()) {
    const name = prop.getName();
    if (skipSet.has(name)) continue;

    const typeNode = prop.getTypeNode();
    if (!typeNode) continue;

    const tsType = resolvePropertyType(typeNode.getText(), baseTypeValidValues, baseTypeNativeMap);
    if (tsType) {
      result.push({ name, tsType });
    }
  }

  return result;
}

function generateFilterFile(
  bo: DesignMetadata,
  context: GenerationContext,
  baseTypeValidValues: Map<string, string[]>,
  baseTypeNativeMap: Map<string, string>
): string {
  const debug = Debug.extend('generateFilterFile');
  const className = pascalCase(bo.name);
  debug('generating filters for %j', className);

  const relationships = resolveRelationships(bo.sourceFile, context);
  const mixins = resolveMixins(bo.sourceFile, context);
  const idProperty = getIdProperty(bo.sourceFile, context);
  const boClass = getClassByBase(bo.sourceFile, 'BusinessObject');

  // Build skip set for scalar property collection (skip id, relationships, FKs)
  const skipNames = new Set<string>();
  skipNames.add(idProperty.name);
  for (const rel of relationships) {
    skipNames.add(rel.relationshipName);
    if (rel.foreignKey) skipNames.add(rel.foreignKey);
  }

  // Collect all scalar properties
  const scalarProps: ScalarProperty[] = [];

  // ID property
  const idTsType = resolveIdOrFkType(idProperty.type, baseTypeNativeMap);
  scalarProps.push({ name: idProperty.name, tsType: idTsType });

  // BO properties
  scalarProps.push(...collectScalarProps(boClass, skipNames, baseTypeValidValues, baseTypeNativeMap));

  // Mixin properties
  for (const mixin of mixins) {
    const mixinClass = getClassByBase(mixin.metadata.sourceFile, 'Mixin');
    scalarProps.push(...collectScalarProps(mixinClass, skipNames, baseTypeValidValues, baseTypeNativeMap));
  }

  // FK properties
  for (const rel of relationships) {
    if ((rel.relationshipType === 'Belongs To' || rel.relationshipType === 'References') && rel.foreignKey && rel.foreignKeyType) {
      const fkTsType = resolveIdOrFkType(rel.foreignKeyType, baseTypeNativeMap);
      scalarProps.push({ name: rel.foreignKey, tsType: fkTsType });
    }
  }

  // Collect relationship info
  const rels: RelationshipInfo[] = relationships.map(rel => ({
    name: rel.relationshipName,
    relatedBoName: rel.businessObjectName,
    type: rel.relationshipType as RelationshipInfo['type']
  }));

  // Build imports for related BO filter types
  const importsByFile = new Map<string, Set<string>>();
  for (const rel of rels) {
    const relKebab = kebabCase(rel.relatedBoName);
    const file = `./${relKebab}.js`;
    if (!importsByFile.has(file)) importsByFile.set(file, new Set());
    if (rel.type === 'Has Many') {
      importsByFile.get(file)!.add(`${rel.relatedBoName}ArrayFilter`);
    } else {
      importsByFile.get(file)!.add(`${rel.relatedBoName}ObjectFilter`);
    }
  }
  // Remove self-imports (self-referencing BOs)
  const selfFile = `./${kebabCase(bo.name)}.js`;
  importsByFile.delete(selfFile);

  const lines: string[] = [];

  // Imports
  lines.push('import type { WhereOperator } from "@apexdesigner/schema-persistence";');
  for (const [file, types] of Array.from(importsByFile.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const sortedTypes = Array.from(types).sort();
    lines.push(`import type { ${sortedTypes.join(', ')} } from "${file}";`);
  }
  lines.push('');

  // WhereFilter
  lines.push(`export interface ${className}WhereFilter {`);
  for (const prop of scalarProps) {
    lines.push(`  ${prop.name}?: WhereOperator<${prop.tsType}>;`);
  }
  lines.push(`  and?: ${className}WhereFilter[];`);
  lines.push(`  or?: ${className}WhereFilter[];`);
  lines.push(`  not?: ${className}WhereFilter;`);
  lines.push('}');
  lines.push('');

  // IncludeFilter
  lines.push(`export interface ${className}IncludeFilter {`);
  for (const rel of rels) {
    if (rel.type === 'Has Many') {
      lines.push(`  ${rel.name}?: ${rel.relatedBoName}ArrayFilter | boolean;`);
    } else {
      lines.push(`  ${rel.name}?: ${rel.relatedBoName}ObjectFilter | boolean;`);
    }
  }
  lines.push('}');
  lines.push('');

  // OrderFilter
  const fieldUnion = scalarProps.map(p => `'${p.name}'`).join(' | ');
  lines.push(`export type ${className}OrderFilter = Array<{`);
  lines.push(`  field: ${fieldUnion};`);
  lines.push("  direction: 'asc' | 'desc';");
  lines.push('}>;');
  lines.push('');

  // ArrayFilter
  lines.push(`export interface ${className}ArrayFilter {`);
  lines.push(`  where?: ${className}WhereFilter;`);
  lines.push(`  include?: ${className}IncludeFilter;`);
  lines.push('  limit?: number;');
  lines.push('  offset?: number;');
  lines.push(`  order?: ${className}OrderFilter;`);
  lines.push('  fields?: string[];');
  lines.push('  omit?: string[];');
  lines.push('}');
  lines.push('');

  // ObjectFilter
  lines.push(`export interface ${className}ObjectFilter {`);
  lines.push(`  include?: ${className}IncludeFilter;`);
  lines.push('  fields?: string[];');
  lines.push('  omit?: string[];');
  lines.push('}');

  return lines.join('\n');
}

function generateBarrel(bos: DesignMetadata[]): string {
  return bos
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(bo => `export type * from './${kebabCase(bo.name)}.js';`)
    .join('\n');
}

/**
 * Build base type lookup maps needed for property type resolution.
 */
function buildBaseTypeMaps(context: GenerationContext) {
  const baseTypeValidValues = new Map<string, string[]>();
  const baseTypeNativeMap = new Map<string, string>();

  for (const bt of context.listMetadata('BaseType')) {
    // Valid values (enum-like base types)
    const valuesCall = getModuleLevelCall(bt.sourceFile, 'applyValidValues');
    if (valuesCall) {
      const args = valuesCall.getArguments();
      const arrayArg = args[1];
      if (arrayArg && Node.isArrayLiteralExpression(arrayArg)) {
        const values: string[] = [];
        for (const element of arrayArg.getElements()) {
          if (Node.isStringLiteral(element)) {
            values.push(element.getLiteralValue());
          } else if (Node.isObjectLiteralExpression(element)) {
            const valueProp = element.getProperty('value');
            if (valueProp && Node.isPropertyAssignment(valueProp)) {
              const init = valueProp.getInitializer();
              if (init && Node.isStringLiteral(init)) {
                values.push(init.getLiteralValue());
              }
            }
          }
        }
        if (values.length > 0) {
          baseTypeValidValues.set(bt.name, values);
        }
      }
    }

    // Native type mapping (e.g., Uuid → string, Email → string)
    const btClass = getClassByBase(bt.sourceFile, 'BaseType');
    if (!btClass) continue;
    const heritage = btClass.getExtends();
    if (!heritage) continue;
    const typeArgs = heritage.getTypeArguments();
    if (typeArgs.length > 0) {
      baseTypeNativeMap.set(pascalCase(bt.name), typeArgs[0].getText());
    }
  }

  return { baseTypeValidValues, baseTypeNativeMap };
}

const boFilterGenerator: DesignGenerator = {
  name: 'bo-filter',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata, conditionContext) => {
        if (!conditionContext?.context) return true;
        return !!getDataSource(metadata.sourceFile, conditionContext.context);
      }
    },
    {
      metadataType: 'Mixin'
    }
  ],

  outputs: (_metadata: DesignMetadata, context: GenerationContext) => {
    const bos = context
      .listMetadata('BusinessObject')
      .filter(bo => !!getDataSource(bo.sourceFile, context));
    return [...bos.map(bo => `server/src/filters/${kebabCase(bo.name)}.ts`), 'server/src/filters/index.ts'];
  },

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const bos = context
      .listMetadata('BusinessObject')
      .filter(bo => !!getDataSource(bo.sourceFile, context));

    debug('generating filters for %d business objects', bos.length);

    const { baseTypeValidValues, baseTypeNativeMap } = buildBaseTypeMaps(context);

    const result = new Map<string, string>();

    for (const bo of bos) {
      const content = generateFilterFile(bo, context, baseTypeValidValues, baseTypeNativeMap);
      result.set(`server/src/filters/${kebabCase(bo.name)}.ts`, content);
    }

    result.set('server/src/filters/index.ts', generateBarrel(bos));

    debug('generated %d filter files + barrel', bos.length);
    return result;
  }
};

export { boFilterGenerator };
