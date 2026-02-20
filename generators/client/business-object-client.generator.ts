import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getIdProperty, resolveRelationships } from '@apexdesigner/generator';
import { getClassByBase, getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import pluralize from 'pluralize';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:businessObjectClient');

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
  'After Start',
]);

const businessObjectClientGenerator: DesignGenerator = {
  name: 'business-object-client',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata) => !isLibrary(metadata),
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `client/src/app/business-objects/${kebabCase(metadata.name)}.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);

    const className = pascalCase(metadata.name);
    const boKebab = kebabCase(metadata.name);
    const plural = pluralize(boKebab);

    // Get id property info
    const idProperty = getIdProperty(metadata.sourceFile, context);
    const idName = idProperty.name;
    let idType = 'number';
    if (idProperty.type === 'string' || idProperty.type === 'String') {
      idType = 'string';
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

      let propType = prop.getType().getText();
      propType = propType.replace(' | undefined', '');

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

    // findById
    lines.push('');
    lines.push(`  static async findById(`);
    lines.push(`    id: string | number,`);
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
    lines.push(`    id: string | number,`);
    lines.push(`    data: Partial<${dataTypeName}>,`);
    lines.push(`  ): Promise<${className}> {`);
    lines.push('    const url = `${this.baseUrl}/${this.plural}/${id}`;');
    lines.push(`    const result = await this.patch<any>(url, data);`);
    lines.push(`    return new ${className}(result);`);
    lines.push('  }');

    // deleteById
    lines.push('');
    lines.push(`  static async deleteById(id: string | number): Promise<boolean> {`);
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

        // Build parameter string
        const paramStr = methodParams
          .map(p => {
            const optional = p.isOptional ? '?' : '';
            return `${p.name}${optional}: ${p.type || 'any'}`;
          })
          .join(', ');

        // Build the body arg from parameters
        const bodyArg = methodParams.length > 0
          ? `{ ${methodParams.map(p => p.name).join(', ')} }`
          : '{}';

        const behaviorKebab = kebabCase(func.name);
        const returnType = func.returnType || 'any';

        const methodLines: string[] = [];
        methodLines.push('');

        if (isInstance) {
          // Instance behavior: POST /api/{plural}/:id/{behavior-kebab}
          methodLines.push(`  async ${func.name}(${paramStr}): Promise<${returnType}> {`);
          methodLines.push(`    const url = \`\${BusinessObjectBase.baseUrl}/\${${className}.plural}/\${(this as any).${idName}}/${behaviorKebab}\`;`);
          methodLines.push(`    return BusinessObjectBase.post<${returnType}>(url, ${bodyArg});`);
          methodLines.push('  }');
        } else {
          // Class behavior: POST /api/{plural}/{behavior-kebab}
          methodLines.push(`  static async ${func.name}(${paramStr}): Promise<${returnType}> {`);
          methodLines.push(`    const url = \`\${this.baseUrl}/\${this.plural}/${behaviorKebab}\`;`);
          methodLines.push(`    return this.post<${returnType}>(url, ${bodyArg});`);
          methodLines.push('  }');
        }

        behaviorMethods.push(methodLines.join('\n'));
        debug('added behavior method %j (instance: %j)', func.name, isInstance);
      } catch (err) {
        debug('error processing behavior %j: %j', behavior.name, err);
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
