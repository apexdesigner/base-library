import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, resolveIdType, resolveRelationships } from '@apexdesigner/generator';
import { getClassByBase, getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import pluralize from 'pluralize';
import createDebug from 'debug';
import { classifyBehaviorParams } from '../shared/classify-params.js';
import { buildBaseTypeMap, resolvePropertyType } from '../shared/base-type-map.js';

const Debug = createDebug('BaseLibrary:generators:businessObjectClient');

// Lifecycle behavior types to exclude
const LIFECYCLE_TYPES = new Set([
  'Before Create',
  'After Create',
  'Before Update',
  'After Update',
  'Before Delete',
  'After Delete',
  'Before Read',
  'After Read',
  'After Start'
]);

const businessObjectClientGenerator: DesignGenerator = {
  name: 'business-object-client',

  triggers: [
    {
      metadataType: 'BusinessObject'
    },
    {
      metadataType: 'Behavior',
      condition: (metadata, conditionContext) => {
        const parentName = getBehaviorParent(metadata.sourceFile);
        if (!parentName) return false;
        if (!conditionContext?.context) return true;
        const boMeta = conditionContext.context.listMetadata('BusinessObject').find(bo => pascalCase(bo.name) === parentName);
        return !!boMeta;
      }
    }
  ],

  outputs: (metadata: DesignMetadata) => {
    const name = getBehaviorParent(metadata.sourceFile) || metadata.name;
    return [`client/src/app/business-objects/${kebabCase(name)}.ts`];
  },

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // If triggered by a Behavior, resolve to the parent BO metadata
    const parentName = getBehaviorParent(metadata.sourceFile);
    if (parentName) {
      const boMeta = context.listMetadata('BusinessObject').find(bo => pascalCase(bo.name) === parentName);
      if (boMeta) {
        debug('resolved behavior %j to parent BO %j', metadata.name, boMeta.name);
        metadata = boMeta;
      }
    }

    debug('START generate for %j', metadata.name);

    const className = pascalCase(metadata.name);
    const boKebab = kebabCase(metadata.name);
    const plural = pluralize(boKebab);

    // Build base type name → native type map (e.g. Email → string, Uuid → string)
    const baseTypeMap = buildBaseTypeMap(context);
    debug('baseTypeMap %O', Object.fromEntries(baseTypeMap));

    // Get id property info — resolve to a primitive TS type
    const resolvedId = resolveIdType(metadata.sourceFile, context);
    const idName = resolvedId.name;
    let idType = resolvedId.type;
    if (idType !== 'string' && idType !== 'number') {
      const match = idType.match(/\.(\w+)$/);
      const typeName = match ? match[1] : idType;
      idType = baseTypeMap.get(typeName) || (idType.includes('import(') || /^[A-Z]/.test(idType) ? 'string' : idType);
    }
    debug('className %j, idName %j, idType %j, plural %j', className, idName, idType, plural);

    // Get the BO class and its properties
    const boClass = getClassByBase(metadata.sourceFile, 'BusinessObject');
    const properties = boClass?.getProperties() || [];

    // Resolve relationships
    const relationships = resolveRelationships(metadata.sourceFile, context);
    debug('relationships count %j', relationships.length);

    // Build skip set for properties handled separately
    const skipNames = new Set<string>();
    skipNames.add(idName);
    relationships.forEach(rel => {
      skipNames.add(rel.relationshipName);
      if (rel.foreignKey) {
        skipNames.add(rel.foreignKey);
      }
    });

    // Collect referenced BO types for imports
    const referencedTypes = new Set<string>();
    relationships.forEach(rel => {
      if (rel.businessObjectName !== className) {
        referencedTypes.add(rel.businessObjectName);
      }
    });

    const dataTypeName = `${className}Data`;

    const lines: string[] = [];

    // --- Imports ---
    lines.push(`import { BusinessObjectBase } from './base';`);

    for (const refType of Array.from(referencedTypes).sort()) {
      lines.push(`import type { ${refType} } from './${kebabCase(refType)}';`);
    }

    lines.push('');

    // --- Data interface ---
    lines.push(`export interface ${dataTypeName} {`);

    // id property
    lines.push(`  readonly ${idName}: ${idType};`);

    // Scalar properties
    for (const prop of properties) {
      const propName = prop.getName();
      if (skipNames.has(propName)) continue;

      const propType = resolvePropertyType(prop, baseTypeMap);

      const optional = prop.hasQuestionToken() ? '?' : '';
      lines.push(`  readonly ${propName}${optional}: ${propType};`);
    }

    // Foreign keys and relationships
    for (const rel of relationships) {
      if (rel.relationshipType === 'Belongs To' || rel.relationshipType === 'References') {
        if (rel.foreignKey && rel.foreignKeyType) {
          let fkType = String(rel.foreignKeyType);
          if (fkType === 'Number' || fkType === 'number' || fkType === 'Serial') {
            fkType = 'number';
          } else if (fkType === 'String' || fkType === 'string') {
            fkType = 'string';
          } else {
            fkType = 'number';
          }
          lines.push(`  readonly ${rel.foreignKey}: ${fkType};`);
        }
      }

      const relProp = properties.find(p => p.getName() === rel.relationshipName);
      const optional = relProp?.hasQuestionToken() ? '?' : '';
      const arraySuffix = rel.relationshipType === 'Has Many' ? '[]' : '';
      lines.push(`  readonly ${rel.relationshipName}${optional}: ${rel.businessObjectName}${arraySuffix};`);
    }

    lines.push('}');
    lines.push('');

    // --- Class declaration ---
    lines.push(`export interface ${className} extends Readonly<${dataTypeName}> {}`);
    lines.push(`export class ${className} extends BusinessObjectBase {`);
    lines.push(`  static readonly entityName = '${className}' as const;`);
    lines.push(`  static readonly plural = '${plural}';`);

    // --- Static CRUD methods ---
    lines.push('');
    lines.push('  // --- Static CRUD methods ---');

    // find
    lines.push('');
    lines.push(`  static async find(filter?: any): Promise<${className}[]> {`);
    lines.push('    const url = `${this.baseUrl}/${this.plural}`;');
    lines.push('    const params: Record<string, string> = {};');
    lines.push("    if (filter) params['filter'] = JSON.stringify(filter);");
    lines.push(`    const results = await this.get<any[]>(url, params);`);
    lines.push(`    return results.map((data) => new ${className}(data));`);
    lines.push('  }');

    // findOne
    lines.push('');
    lines.push(`  static async findOne(filter?: any): Promise<${className} | null> {`);
    lines.push('    const url = `${this.baseUrl}/${this.plural}/find-one`;');
    lines.push('    const params: Record<string, string> = {};');
    lines.push("    if (filter) params['filter'] = JSON.stringify(filter);");
    lines.push('    const data = await this.get<any>(url, params);');
    lines.push(`    return data ? new ${className}(data) : null;`);
    lines.push('  }');

    // findById
    lines.push('');
    lines.push(`  static async findById(`);
    lines.push(`    id: ${idType},`);
    lines.push(`    filter?: any,`);
    lines.push(`  ): Promise<${className}> {`);
    lines.push('    const url = `${this.baseUrl}/${this.plural}/${id}`;');
    lines.push('    const params: Record<string, string> = {};');
    lines.push("    if (filter) params['filter'] = JSON.stringify(filter);");
    lines.push(`    const data = await this.get<any>(url, params);`);
    lines.push(`    return new ${className}(data);`);
    lines.push('  }');

    // create
    lines.push('');
    lines.push(`  static async create(data: Omit<${dataTypeName}, '${idName}'>): Promise<${className}> {`);
    lines.push('    const url = `${this.baseUrl}/${this.plural}`;');
    lines.push(`    const result = await this.post<any>(url, data);`);
    lines.push(`    return new ${className}(result);`);
    lines.push('  }');

    // updateById
    lines.push('');
    lines.push(`  static async updateById(`);
    lines.push(`    id: ${idType},`);
    lines.push(`    data: Partial<${dataTypeName}>,`);
    lines.push(`  ): Promise<${className}> {`);
    lines.push('    const url = `${this.baseUrl}/${this.plural}/${id}`;');
    lines.push(`    const result = await this.patch<any>(url, data);`);
    lines.push(`    return new ${className}(result);`);
    lines.push('  }');

    // deleteById
    lines.push('');
    lines.push(`  static async deleteById(id: ${idType}): Promise<boolean> {`);
    lines.push('    const url = `${this.baseUrl}/${this.plural}/${id}`;');
    lines.push('    try {');
    lines.push('      await this.del<void>(url);');
    lines.push('      return true;');
    lines.push('    } catch {');
    lines.push('      return false;');
    lines.push('    }');
    lines.push('  }');

    // --- Behaviors ---
    const allBehaviors = context.listMetadata('Behavior');
    debug('total behaviors in project %j', allBehaviors.length);

    const behaviorMethods: string[] = [];

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const parent = getBehaviorParent(behavior.sourceFile);
        if (parent !== className) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        // Skip lifecycle behaviors
        if (LIFECYCLE_TYPES.has(options.type as string)) continue;

        const isInstance = options.type === 'Instance';

        // Get parameters: skip first for instance behaviors (it's the instance itself)
        const params = func.parameters || [];
        const methodParams = isInstance ? params.slice(1) : params;

        // Classify params by source
        const routePath = options.path as string | undefined;
        const classified = classifyBehaviorParams(methodParams, routePath);

        // Build parameter string — use inner type for Header<T> params
        const paramStr = methodParams
          .map(p => {
            const cp = classified.all.find(c => c.name === p.name);
            const optional = p.isOptional ? '?' : '';
            const type = cp?.source === 'header' ? cp.innerType || 'string' : p.type || 'any';
            return `${p.name}${optional}: ${type}`;
          })
          .join(', ');

        // Build the body arg from body-only parameters
        const OBJECT_TYPES = new Set(['any', 'object', 'Record']);
        const bodyIsPassthrough =
          classified.body.length === 1 && (OBJECT_TYPES.has(classified.body[0].type || 'any') || (classified.body[0].type || '').startsWith('{'));
        const bodyArg =
          classified.body.length === 0 ? '{}' : bodyIsPassthrough ? classified.body[0].name : `{ ${classified.body.map(p => p.name).join(', ')} }`;

        // Build headers arg from header params
        const hasHeaders = classified.header.length > 0;
        const headersArg = hasHeaders ? `{ ${classified.header.map(p => p.name).join(', ')} }` : undefined;

        const behaviorKebab = kebabCase(func.name);
        const returnType = func.returnType || 'any';

        const methodLines: string[] = [];
        methodLines.push('');

        const httpMethod = ((options.httpMethod as string) || 'Post').toLowerCase();

        // Build URL expression — interpolate path params if custom path
        let urlExpr: string;
        if (routePath && classified.path.length > 0) {
          // Custom path with path params — build URL with interpolation
          let urlPath = routePath.replace(/^\/api/, '');
          for (const pp of classified.path) {
            urlPath = urlPath.replace(`:${pp.name}`, `\${${pp.name}}`);
          }
          const base = isInstance ? 'BusinessObjectBase.baseUrl' : 'this.baseUrl';
          urlExpr = `\`\${${base}}${urlPath}\``;
        } else if (isInstance) {
          urlExpr = `\`\${BusinessObjectBase.baseUrl}/\${${className}.plural}/\${(this as any).${idName}}/${behaviorKebab}\``;
        } else {
          urlExpr = `\`\${this.baseUrl}/\${this.plural}/${behaviorKebab}\``;
        }

        // Map httpMethod to base class method call
        const callForMethod = (base: string) => {
          const hArg = headersArg ? `, ${headersArg}` : '';
          switch (httpMethod) {
            case 'get':
              return hasHeaders ? `${base}.get<${returnType}>(url, undefined, ${headersArg})` : `${base}.get<${returnType}>(url)`;
            case 'delete':
              return hasHeaders ? `${base}.del<${returnType}>(url, ${headersArg})` : `${base}.del<${returnType}>(url)`;
            case 'patch':
              return `${base}.patch<${returnType}>(url, ${bodyArg}${hArg})`;
            default:
              return `${base}.post<${returnType}>(url, ${bodyArg}${hArg})`;
          }
        };

        if (isInstance) {
          // Instance behavior: /api/{plural}/:id/{behavior-kebab}
          methodLines.push(`  async ${func.name}(${paramStr}): Promise<${returnType}> {`);
          methodLines.push(`    const url = ${urlExpr};`);
          methodLines.push(`    return ${callForMethod('BusinessObjectBase')};`);
          methodLines.push('  }');
        } else {
          // Class behavior: /api/{plural}/{behavior-kebab}
          methodLines.push(`  static async ${func.name}(${paramStr}): Promise<${returnType}> {`);
          methodLines.push(`    const url = ${urlExpr};`);
          methodLines.push(`    return ${callForMethod('this')};`);
          methodLines.push('  }');
        }

        behaviorMethods.push(methodLines.join('\n'));
        debug('added behavior method %j (instance: %j)', func.name, isInstance);
      } catch (err) {
        debug('error processing behavior %j: %j', behavior.name, err);
      }
    }

    // Carry over imports from behavior design files
    const behaviorInterfaceDefinitionImports = new Set<string>();
    const behaviorBusinessObjectImports = new Set<string>();

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;
        const parent = getBehaviorParent(behavior.sourceFile);
        if (parent !== className) continue;
        if (LIFECYCLE_TYPES.has(options.type as string)) continue;

        for (const importDeclaration of behavior.sourceFile.getImportDeclarations()) {
          const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
          for (const namedImport of importDeclaration.getNamedImports()) {
            const importName = namedImport.getName();
            if (moduleSpecifier === '@interface-definitions') {
              behaviorInterfaceDefinitionImports.add(importName);
            } else if (moduleSpecifier === '@business-objects' && importName !== className) {
              behaviorBusinessObjectImports.add(importName);
            }
          }
        }
      } catch {
        // Skip errors — behaviors already processed above
      }
    }

    // Add interface definition imports
    if (behaviorInterfaceDefinitionImports.size > 0) {
      const importLine = `import type { ${Array.from(behaviorInterfaceDefinitionImports).sort().join(', ')} } from '../interface-definitions/index';`;
      const lastImportIndex = lines.findIndex(line => line === '');
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex, 0, importLine);
      }
    }

    // Add business object imports not already covered by relationships
    for (const businessObjectName of Array.from(behaviorBusinessObjectImports).sort()) {
      if (!referencedTypes.has(businessObjectName)) {
        const importLine = `import type { ${businessObjectName} } from './${kebabCase(businessObjectName)}';`;
        const lastImportIndex = lines.findIndex(line => line === '');
        if (lastImportIndex >= 0) {
          lines.splice(lastImportIndex, 0, importLine);
        }
      }
    }

    if (behaviorMethods.length > 0) {
      lines.push('');
      lines.push('  // --- Behaviors ---');
      lines.push(behaviorMethods.join(''));
    }

    // Close class
    lines.push('}');

    const content = lines.join('\n');
    debug('Generated client business object file for %j', metadata.name);

    return content;
  }
};

export { businessObjectClientGenerator };
