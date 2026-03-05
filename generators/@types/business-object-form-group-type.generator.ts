import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getIdProperty, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase, getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:businessObjectFormGroupType');

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

const businessObjectFormGroupTypeGenerator: DesignGenerator = {
  name: 'business-object-form-group-type',

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
      `design/@types/business-objects-client/${kebabCase(name)}-form-group.d.ts`,
      `design/@types/business-objects-client/${kebabCase(name)}-form-array.d.ts`,
      `design/@types/business-objects-client/${kebabCase(name)}-persisted-array.d.ts`,
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

    // Build skip set (properties handled as relationships)
    const skipNames = new Set<string>();
    skipNames.add(idProperty.name);
    relationships.forEach(rel => {
      skipNames.add(rel.relationshipName);
      if (rel.foreignKey) {
        skipNames.add(rel.foreignKey);
      }
    });

    // Collect referenced type imports for the form-group file
    // Has Many → import FormArray from -form-array; others → import FormGroup from -form-group
    const formArrayImports = new Map<string, Set<string>>();
    const formGroupImports = new Map<string, Set<string>>();
    for (const rel of relationships) {
      if (rel.businessObjectName === className) continue;
      if (rel.relationshipType === 'Has Many') {
        if (!formArrayImports.has(rel.businessObjectName)) {
          formArrayImports.set(rel.businessObjectName, new Set());
        }
        formArrayImports.get(rel.businessObjectName)!.add(`${rel.businessObjectName}FormArray`);
      } else {
        if (!formGroupImports.has(rel.businessObjectName)) {
          formGroupImports.set(rel.businessObjectName, new Set());
        }
        formGroupImports.get(rel.businessObjectName)!.add(`${rel.businessObjectName}FormGroup`);
      }
    }

    // Build controls for form-group
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
      if (rel.relationshipType === 'Belongs To' || rel.relationshipType === 'References') {
        if (rel.foreignKey) {
          controlLines.push(`    ${rel.foreignKey}: SchemaFormControl;`);
        }
      }

      if (rel.relationshipType === 'Has Many') {
        controlLines.push(`    ${rel.relationshipName}: ${rel.businessObjectName}FormArray;`);
      } else {
        controlLines.push(`    ${rel.relationshipName}: ${rel.businessObjectName}FormGroup;`);
      }
    }

    // ── form-group.d.ts ───────────────────────────────────────────────────────
    const fgLines: string[] = [];
    fgLines.push(`// Generated form group type for ${metadata.name} business object`);
    fgLines.push('');
    fgLines.push(`import type { ${className} } from './${boKebab}';`);
    for (const [refType, importNames] of Array.from(formArrayImports).sort((a, b) => a[0].localeCompare(b[0]))) {
      fgLines.push(`import type { ${Array.from(importNames).sort().join(', ')} } from './${kebabCase(refType)}-form-array';`);
    }
    for (const [refType, importNames] of Array.from(formGroupImports).sort((a, b) => a[0].localeCompare(b[0]))) {
      fgLines.push(`import type { ${Array.from(importNames).sort().join(', ')} } from './${kebabCase(refType)}-form-group';`);
    }
    fgLines.push(`import type { SchemaFormControl } from '@apexdesigner/schema-forms';`);
    fgLines.push(`import type { PersistedFormGroup, PersistedFormGroupOptions } from './persisted-form-group';`);
    fgLines.push('');
    fgLines.push(`export declare class ${className}FormGroup extends PersistedFormGroup {`);
    fgLines.push(`  declare controls: {`);
    fgLines.push(...controlLines);
    fgLines.push(`  };`);
    fgLines.push('');
    fgLines.push(`  declare value: Partial<${className}>;`);
    fgLines.push('');
    fgLines.push(`  constructor(options?: PersistedFormGroupOptions);`);
    fgLines.push(`  get object(): ${className};`);

    // Instance behavior method declarations
    const allBehaviors = context.listMetadata('Behavior');

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const parent = getBehaviorParent(behavior.sourceFile);
        if (parent !== className) continue;

        if (options.type !== 'Instance') continue;
        if (LIFECYCLE_TYPES.has(options.type as string)) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        const params = func.parameters || [];
        const methodParams = params.slice(1);

        const paramStr = methodParams
          .map(p => {
            const optional = p.isOptional ? '?' : '';
            return `${p.name}${optional}: ${p.type || 'any'}`;
          })
          .join(', ');

        const returnType = func.returnType || 'any';

        fgLines.push(`  ${func.name}(${paramStr}): Promise<${returnType}>;`);
        debug('added behavior type declaration %j', func.name);
      } catch (err) {
        debug('error processing behavior %j: %j', behavior.name, err);
      }
    }

    fgLines.push(`}`);

    // ── form-array.d.ts ───────────────────────────────────────────────────────
    const faLines: string[] = [];
    faLines.push(`import type { PersistedFormArray, PersistedFormArrayOptions } from './persisted-form-group';`);
    faLines.push(`import type { ${className} } from './${boKebab}';`);
    faLines.push('');
    faLines.push(`export declare class ${className}FormArray extends PersistedFormArray {`);
    faLines.push(`  readonly entityName: '${className}';`);
    faLines.push(`  constructor(options?: PersistedFormArrayOptions);`);
    faLines.push(`  get array(): ${className}[];`);
    faLines.push(`}`);

    // ── persisted-array.d.ts ──────────────────────────────────────────────────
    const paLines: string[] = [];
    paLines.push(`import type { ${className} } from './${boKebab}';`);
    paLines.push(`import type { PersistedArray, PersistedArrayOptions } from './persisted-form-group';`);
    paLines.push('');
    paLines.push(`export declare class ${className}PersistedArray extends PersistedArray<${className}> {`);
    paLines.push(`  readonly entityName: '${className}';`);
    paLines.push(`  constructor(options?: PersistedArrayOptions);`);
    paLines.push(`}`);

    const outputs = new Map<string, string>();
    outputs.set(`design/@types/business-objects-client/${boKebab}-form-group.d.ts`, fgLines.join('\n') + '\n');
    outputs.set(`design/@types/business-objects-client/${boKebab}-form-array.d.ts`, faLines.join('\n') + '\n');
    outputs.set(`design/@types/business-objects-client/${boKebab}-persisted-array.d.ts`, paLines.join('\n') + '\n');

    debug('Generated form group type files for %j', metadata.name);
    return outputs;
  }
};

export { businessObjectFormGroupTypeGenerator };
