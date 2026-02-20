import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getIdProperty, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:businessObjectFormGroup');

const businessObjectFormGroupGenerator: DesignGenerator = {
  name: 'business-object-form-group',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata) => !isLibrary(metadata),
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `client/src/app/business-objects/${kebabCase(metadata.name)}-form-group.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
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
    // Add nested controls for relationships
    for (const rel of relationships) {
      if (rel.relationshipType === 'Has Many') {
        lines.push(`    this.setControl('${rel.relationshipName}', new ${rel.businessObjectName}FormArray());`);
      } else {
        lines.push(`    this.setControl('${rel.relationshipName}', new ${rel.businessObjectName}FormGroup());`);
      }
    }
    lines.push(`  }`);
    lines.push('}');
    lines.push('');
    lines.push(`export class ${className}FormArray extends PersistedFormArray {`);
    lines.push(`  constructor(options?: PersistedFormArrayOptions) {`);
    lines.push(`    super(${schemaVarName}, ${className}, options);`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');
    lines.push(`export class ${className}PersistedArray extends PersistedArray<${className}> {`);
    lines.push(`  constructor(options?: PersistedArrayOptions) {`);
    lines.push(`    super(${className}, options);`);
    lines.push(`  }`);
    lines.push(`}`);

    const content = lines.join('\n') + '\n';
    debug('Generated form group client class for %j', metadata.name);

    return content;
  }
};

export { businessObjectFormGroupGenerator };
