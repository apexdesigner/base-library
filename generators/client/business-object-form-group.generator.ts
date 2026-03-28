import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getIdProperty, resolveIdType, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import { buildBaseTypeMap } from '../shared/base-type-map.js';
import { getClassByBase, getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:businessObjectFormGroup');

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

const businessObjectFormGroupGenerator: DesignGenerator = {
  name: 'business-object-form-group',

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
    return [`client/src/app/business-objects/${kebabCase(name)}-form-group.ts`];
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

    debug('name %j', metadata.name);

    const className = pascalCase(metadata.name);
    const boKebab = kebabCase(metadata.name);

    // Get id property info
    const idProperty = getIdProperty(metadata.sourceFile, context);

    // Get the BO class and its properties
    const boClass = getClassByBase(metadata.sourceFile, 'BusinessObject');
    const properties = boClass?.getProperties() || [];

    // Resolve relationships and mixins
    const relationships = resolveRelationships(metadata.sourceFile, context);
    const mixins = resolveMixins(metadata.sourceFile, context);

    // Build skip set
    const skipNames = new Set<string>();
    skipNames.add(idProperty.name);
    relationships.forEach(rel => {
      skipNames.add(rel.relationshipName);
      if (rel.foreignKey) {
        skipNames.add(rel.foreignKey);
      }
    });

    // Collect referenced type imports based on relationship types
    // Map: refTypeName → Set of import names (e.g. 'SupplierFormGroup', 'LocationFormArray')
    const refTypeImports = new Map<string, Set<string>>();
    for (const rel of relationships) {
      if (rel.businessObjectName === className) continue;
      if (!refTypeImports.has(rel.businessObjectName)) {
        refTypeImports.set(rel.businessObjectName, new Set());
      }
      const imports = refTypeImports.get(rel.businessObjectName)!;
      if (rel.relationshipType === 'Has Many') {
        imports.add(`${rel.businessObjectName}FormArray`);
      } else {
        imports.add(`${rel.businessObjectName}FormGroup`);
      }
    }

    const lines: string[] = [];

    // --- Imports ---
    lines.push(`import { PersistedFormGroup, PersistedFormArray, PersistedArray } from './persisted-form-group';`);
    lines.push(`import type { PersistedFormGroupOptions, PersistedFormArrayOptions, PersistedArrayOptions } from './persisted-form-group';`);
    lines.push(`import type { SchemaFormControl } from '@apexdesigner/schema-forms';`);
    lines.push(`import { ${className} } from './${boKebab}';`);
    lines.push(`export { ${className} };`);

    // Schema import: camelCase name + 'Schema' from @schemas alias
    const schemaVarName = `${className.charAt(0).toLowerCase()}${className.slice(1)}Schema`;
    lines.push(`import { ${schemaVarName} } from '@schemas/business-objects/${boKebab}';`);

    // Import referenced form group/array types (all are instantiated with new)
    for (const [refType, importNames] of Array.from(refTypeImports).sort((a, b) => a[0].localeCompare(b[0]))) {
      const refKebab = kebabCase(refType);
      const allNames = Array.from(importNames).sort();
      lines.push(`import { ${allNames.join(', ')} } from './${refKebab}-form-group';`);
    }

    lines.push('');

    // --- Build controls interface ---
    const controlEntries: string[] = [];

    // id
    controlEntries.push(`    ${idProperty.name}: SchemaFormControl;`);

    // Scalar properties from BO class
    for (const prop of properties) {
      const propName = prop.getName();
      if (skipNames.has(propName)) continue;
      controlEntries.push(`    ${propName}: SchemaFormControl;`);
    }

    // Mixin properties
    for (const mixin of mixins) {
      const mixinClass = getClassByBase(mixin.metadata.sourceFile, 'Mixin');
      if (!mixinClass) continue;
      for (const prop of mixinClass.getProperties()) {
        const propName = prop.getName();
        if (skipNames.has(propName)) continue;
        controlEntries.push(`    ${propName}: SchemaFormControl;`);
      }
    }

    // FK and relationship controls
    for (const rel of relationships) {
      if (rel.relationshipType === 'Belongs To' || rel.relationshipType === 'References') {
        if (rel.foreignKey) {
          controlEntries.push(`    ${rel.foreignKey}: SchemaFormControl;`);
        }
      }
      if (rel.relationshipType === 'Has Many') {
        controlEntries.push(`    ${rel.relationshipName}: ${rel.businessObjectName}FormArray;`);
      } else {
        controlEntries.push(`    ${rel.relationshipName}: ${rel.businessObjectName}FormGroup;`);
      }
    }

    // --- Class ---
    lines.push(`export class ${className}FormGroup extends PersistedFormGroup {`);
    lines.push(`  declare controls: {`);
    lines.push(...controlEntries);
    lines.push(`  };`);
    lines.push('');
    lines.push(`  declare value: Partial<${className}>;`);
    lines.push('');
    lines.push(`  constructor(data?: Record<string, any> | null, options?: PersistedFormGroupOptions) {`);
    lines.push(`    super(${schemaVarName}, ${className}, data, options);`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  get object(): ${className} {`);
    lines.push(`    return new ${className}(this.getRawValue());`);
    lines.push(`  }`);

    // Generate createControl factory for lazy initialization of relationship controls
    const relCases: string[] = [];
    for (const rel of relationships) {
      if (rel.relationshipType === 'Has Many') {
        relCases.push(`      case '${rel.relationshipName}': return new ${rel.businessObjectName}FormArray();`);
      } else {
        relCases.push(`      case '${rel.relationshipName}': return new ${rel.businessObjectName}FormGroup();`);
      }
    }
    if (relCases.length > 0) {
      lines.push('');
      lines.push('  protected override createControl(name: string) {');
      lines.push('    switch (name) {');
      lines.push(...relCases);
      lines.push('      default: return undefined;');
      lines.push('    }');
      lines.push('  }');
    }

    // --- Static CRUD methods (delegate to entity class) ---
    const baseTypeMap = buildBaseTypeMap(context);
    const resolvedId = resolveIdType(metadata.sourceFile, context);
    let idType = resolvedId.type;
    if (idType !== 'string' && idType !== 'number') {
      const match = idType.match(/\.(\w+)$/);
      const typeName = match ? match[1] : idType;
      idType = baseTypeMap.get(typeName) || (idType.includes('import(') || /^[A-Z]/.test(idType) ? 'string' : idType);
    }

    lines.push('');
    lines.push(`  static async find(filter?: any): Promise<${className}[]> {`);
    lines.push(`    return ${className}.find(filter);`);
    lines.push('  }');
    lines.push('');
    lines.push(`  static async findOne(filter?: any): Promise<${className} | null> {`);
    lines.push(`    return ${className}.findOne(filter);`);
    lines.push('  }');
    lines.push('');
    lines.push(`  static async findById(id: ${idType}, filter?: any): Promise<${className}> {`);
    lines.push(`    return ${className}.findById(id, filter);`);
    lines.push('  }');
    lines.push('');
    lines.push(`  static async create(data: Partial<${className}>): Promise<${className}> {`);
    lines.push(`    return ${className}.create(data as any);`);
    lines.push('  }');
    lines.push('');
    lines.push(`  static async updateById(id: ${idType}, data: Partial<${className}>): Promise<${className}> {`);
    lines.push(`    return ${className}.updateById(id, data as any);`);
    lines.push('  }');
    lines.push('');
    lines.push(`  static async deleteById(id: ${idType}): Promise<boolean> {`);
    lines.push(`    return ${className}.deleteById(id);`);
    lines.push('  }');

    // --- Carry over imports from behavior DSL files ---
    const allBehaviors = context.listMetadata('Behavior');
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
        // Skip errors — behaviors processed below
      }
    }

    if (behaviorInterfaceDefinitionImports.size > 0) {
      const importLine = `import type { ${Array.from(behaviorInterfaceDefinitionImports).sort().join(', ')} } from '../interface-definitions/index';`;
      const lastImportIndex = lines.findIndex(line => line === '');
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex, 0, importLine);
      }
    }

    // Add BO imports not already covered by relationship imports
    const existingImportNames = new Set(Array.from(refTypeImports.keys()));
    for (const businessObjectName of Array.from(behaviorBusinessObjectImports).sort()) {
      if (!existingImportNames.has(businessObjectName)) {
        const importLine = `import type { ${businessObjectName} } from './${kebabCase(businessObjectName)}';`;
        const lastImportIndex = lines.findIndex(line => line === '');
        if (lastImportIndex >= 0) {
          lines.splice(lastImportIndex, 0, importLine);
        }
      }
    }

    // --- Behavior delegation ---
    const behaviorMethods: string[] = [];

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const parent = getBehaviorParent(behavior.sourceFile);
        if (parent !== className) continue;

        // Skip lifecycle behaviors
        if (LIFECYCLE_TYPES.has(options.type as string)) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        const isInstance = options.type === 'Instance';
        const params = func.parameters || [];
        const methodParams = isInstance ? params.slice(1) : params;

        // Build parameter signature
        const paramStr = methodParams
          .map(p => {
            const optional = p.isOptional ? '?' : '';
            // Resolve Header<T> to inner type T
            let type = p.type || 'any';
            const headerMatch = type.match(/^Header<(.+)>$/);
            if (headerMatch) type = headerMatch[1];
            return `${p.name}${optional}: ${type}`;
          })
          .join(', ');

        // Build argument list for delegation call
        const argStr = methodParams.map(p => p.name).join(', ');

        const returnType = func.returnType || 'any';

        if (isInstance) {
          behaviorMethods.push('');
          behaviorMethods.push(`  async ${func.name}(${paramStr}): Promise<${returnType}> {`);
          behaviorMethods.push(`    const instance = new ${className}(this.value);`);
          behaviorMethods.push(`    return instance.${func.name}(${argStr});`);
        } else {
          behaviorMethods.push('');
          behaviorMethods.push(`  static async ${func.name}(${paramStr}): Promise<${returnType}> {`);
          behaviorMethods.push(`    return ${className}.${func.name}(${argStr});`);
        }
        behaviorMethods.push('  }');

        debug('added delegating behavior method %j', func.name);
      } catch (err) {
        debug('error processing behavior %j: %j', behavior.name, err);
      }
    }

    if (behaviorMethods.length > 0) {
      lines.push(...behaviorMethods);
    }

    lines.push('}');
    lines.push('');
    lines.push(`export class ${className}FormArray extends PersistedFormArray {`);
    lines.push(`  readonly entityName = '${className}' as const;`);
    lines.push('');
    lines.push(`  constructor(options?: PersistedFormArrayOptions) {`);
    lines.push(`    super(${schemaVarName}, ${className}, options);`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  protected override createItemGroup() {`);
    lines.push(`    return new ${className}FormGroup();`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  get array(): ${className}[] {`);
    lines.push(`    return this.controls.map((group: ${className}FormGroup) => group.object);`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');
    lines.push(`export class ${className}PersistedArray extends PersistedArray<${className}> {`);
    lines.push(`  readonly entityName = '${className}' as const;`);
    lines.push('');
    lines.push(`  constructor(options?: PersistedArrayOptions) {`);
    lines.push(`    super(${className}, options);`);
    lines.push(`  }`);
    lines.push(`}`);

    const content = lines.join('\n') + '\n';
    debug('Generated form group client class for %j', metadata.name);

    const outputs = new Map<string, string>();
    outputs.set(`client/src/app/business-objects/${boKebab}-form-group.ts`, content);

    return outputs;
  }
};

export { businessObjectFormGroupGenerator };
