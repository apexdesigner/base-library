import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getIdProperty, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:businessObjectFormGroupType');

const businessObjectFormGroupTypeGenerator: DesignGenerator = {
  name: 'business-object-form-group-type',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata) => !isLibrary(metadata),
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `design/@types/business-objects/${kebabCase(metadata.name)}-form-group.d.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('name %j', metadata.name);

    const className = pascalCase(metadata.name);

    // Get id property info
    const idProperty = getIdProperty(metadata.sourceFile, context);

    // Get the BO class and its properties
    const boClass = getClassByBase(metadata.sourceFile, 'BusinessObject');
    const properties = boClass?.getProperties() || [];

    // Resolve relationships and mixins
    const relationships = resolveRelationships(metadata.sourceFile, context);
    const mixins = resolveMixins(metadata.sourceFile, context);

    // Build skip set (properties handled as relationships)
    const skipNames = new Set<string>();
    skipNames.add(idProperty.name);
    relationships.forEach(rel => {
      skipNames.add(rel.relationshipName);
      if (rel.foreignKey) {
        skipNames.add(rel.foreignKey);
      }
    });

    // Collect referenced type imports based on relationship types
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

    lines.push(`// Generated form group type for ${metadata.name} business object`);
    lines.push('');

    // Import the BO type
    lines.push(`import type { ${className} } from './${kebabCase(className)}';`);

    // Import referenced form group/array types (all from -form-group file)
    for (const [refType, importNames] of Array.from(refTypeImports).sort((a, b) => a[0].localeCompare(b[0]))) {
      const refKebab = kebabCase(refType);
      lines.push(`import type { ${Array.from(importNames).sort().join(', ')} } from './${refKebab}-form-group';`);
    }

    // Import schema-forms types
    lines.push(`import type { SchemaFormControl } from '@apexdesigner/schema-forms';`);
    lines.push(`import type { PersistedFormGroup, PersistedFormGroupOptions, PersistedFormArray, PersistedFormArrayOptions, PersistedArray, PersistedArrayOptions } from '@business-objects/persisted-form-group';`);
    lines.push('');

    // Build the controls type
    const controlLines: string[] = [];

    // id property
    controlLines.push(`    ${idProperty.name}: SchemaFormControl;`);

    // Scalar properties from BO class
    for (const prop of properties) {
      const propName = prop.getName();
      if (skipNames.has(propName)) continue;
      controlLines.push(`    ${propName}: SchemaFormControl;`);
    }

    // Mixin properties
    for (const mixin of mixins) {
      const mixinClass = getClassByBase(mixin.metadata.sourceFile, 'Mixin');
      if (!mixinClass) continue;
      for (const prop of mixinClass.getProperties()) {
        const propName = prop.getName();
        if (skipNames.has(propName)) continue;
        controlLines.push(`    ${propName}: SchemaFormControl;`);
      }
    }

    // Foreign keys and relationship controls
    for (const rel of relationships) {
      // FK as SchemaFormControl
      if (rel.relationshipType === 'Belongs To' || rel.relationshipType === 'References') {
        if (rel.foreignKey) {
          controlLines.push(`    ${rel.foreignKey}: SchemaFormControl;`);
        }
      }

      // Relationship as form group or form array
      if (rel.relationshipType === 'Has Many') {
        controlLines.push(`    ${rel.relationshipName}: ${rel.businessObjectName}FormArray;`);
      } else {
        controlLines.push(`    ${rel.relationshipName}: ${rel.businessObjectName}FormGroup;`);
      }
    }

    // Class declaration — extends PersistedFormGroup which provides
    // reading, saving, filter, read(), save(), autoSave()
    lines.push(`export declare class ${className}FormGroup extends PersistedFormGroup {`);
    lines.push(`  declare controls: {`);
    lines.push(...controlLines);
    lines.push(`  };`);
    lines.push('');
    lines.push(`  declare value: Partial<${className}>;`);
    lines.push('');
    lines.push(`  constructor(options?: PersistedFormGroupOptions);`);
    lines.push(`}`);
    lines.push('');
    lines.push(`export declare class ${className}FormArray extends PersistedFormArray {`);
    lines.push(`  constructor(options?: PersistedFormArrayOptions);`);
    lines.push(`}`);
    lines.push('');
    lines.push(`export declare class ${className}PersistedArray extends PersistedArray<${className}> {`);
    lines.push(`  constructor(options?: PersistedArrayOptions);`);
    lines.push(`}`);

    const content = lines.join('\n') + '\n';
    debug('Generated form group type file for %j', metadata.name);

    return content;
  }
};

export { businessObjectFormGroupTypeGenerator };
