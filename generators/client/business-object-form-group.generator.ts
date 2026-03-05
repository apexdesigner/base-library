import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getIdProperty, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
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
  'After Start',
]);

const businessObjectFormGroupGenerator: DesignGenerator = {
  name: 'business-object-form-group',

  triggers: [
    {
      metadataType: 'BusinessObject',
    },
    {
      metadataType: 'Behavior',
      condition: (metadata, conditionContext) => {
        const parentName = getBehaviorParent(metadata.sourceFile);
        if (!parentName) return false;
        if (!conditionContext?.context) return true;
        const boMeta = conditionContext.context.listMetadata('BusinessObject')
          .find(bo => pascalCase(bo.name) === parentName);
        return !!boMeta;
      },
    },
  ],

  outputs: (metadata: DesignMetadata) => {
    const name = getBehaviorParent(metadata.sourceFile) || metadata.name;
    return [
      `client/src/app/business-objects/${kebabCase(name)}-form-group.ts`,
    ];
  },

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // If triggered by a Behavior, resolve to the parent BO metadata
    const parentName = getBehaviorParent(metadata.sourceFile);
    if (parentName) {
      const boMeta = context.listMetadata('BusinessObject')
        .find(bo => pascalCase(bo.name) === parentName);
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
    lines.push(`  constructor(options?: PersistedFormGroupOptions) {`);
    lines.push(`    super(${schemaVarName}, ${className}, options);`);
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

    // --- Instance behavior delegation ---
    const allBehaviors = context.listMetadata('Behavior');
    const behaviorMethods: string[] = [];

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const parent = getBehaviorParent(behavior.sourceFile);
        if (parent !== className) continue;

        // Only delegate instance behaviors
        if (options.type !== 'Instance') continue;

        // Skip lifecycle behaviors
        if (LIFECYCLE_TYPES.has(options.type as string)) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        // Get parameters: skip first for instance behaviors (it's the instance itself)
        const params = func.parameters || [];
        const methodParams = params.slice(1);

        // Build parameter signature
        const paramStr = methodParams
          .map(p => {
            const optional = p.isOptional ? '?' : '';
            return `${p.name}${optional}: ${p.type || 'any'}`;
          })
          .join(', ');

        // Build argument list for delegation call
        const argStr = methodParams.map(p => p.name).join(', ');

        const returnType = func.returnType || 'any';

        behaviorMethods.push('');
        behaviorMethods.push(`  async ${func.name}(${paramStr}): Promise<${returnType}> {`);
        behaviorMethods.push(`    const instance = new ${className}(this.value);`);
        behaviorMethods.push(`    return instance.${func.name}(${argStr});`);
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
