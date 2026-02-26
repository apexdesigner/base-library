import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, resolveIdType, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase, getDescription, getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:businessObjectClientType');

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

const businessObjectClientTypeGenerator: DesignGenerator = {
  name: 'business-object-client-type',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata) => !isLibrary(metadata),
    },
    {
      metadataType: 'Behavior',
      condition: (metadata, conditionContext) => {
        const parentName = getBehaviorParent(metadata.sourceFile);
        if (!parentName) return false;
        if (!conditionContext?.context) return true;
        const boMeta = conditionContext.context.listMetadata('BusinessObject')
          .find(bo => pascalCase(bo.name) === parentName);
        return !!boMeta && !isLibrary(boMeta);
      },
    },
  ],

  outputs: (metadata: DesignMetadata) => {
    const name = getBehaviorParent(metadata.sourceFile) || metadata.name;
    return [`design/@types/business-objects-client/${kebabCase(name)}.d.ts`];
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

    // Get id property info — resolve to a primitive TS type
    const resolvedId = resolveIdType(metadata.sourceFile, context);
    const idName = resolvedId.name;
    let idType = resolvedId.type;
    if (idType !== 'string' && idType !== 'number') {
      idType = idType.includes('import(') || /^[A-Z]/.test(idType) ? 'string' : idType;
    }

    // Build base type name → native type map (e.g. Email → string, Uuid → string)
    const baseTypeMap = new Map<string, string>();
    for (const bt of context.listMetadata('BaseType')) {
      const btClass = getClassByBase(bt.sourceFile, 'BaseType');
      if (!btClass) continue;
      const heritage = btClass.getExtends();
      if (!heritage) continue;
      const typeArgs = heritage.getTypeArguments();
      if (typeArgs.length > 0) {
        baseTypeMap.set(pascalCase(bt.name), typeArgs[0].getText());
      }
    }

    // Get the BO class and its properties
    const boClass = getClassByBase(metadata.sourceFile, 'BusinessObject');
    const description = boClass ? getDescription(boClass) : undefined;
    const properties = boClass?.getProperties() || [];

    // Resolve relationships
    const relationships = resolveRelationships(metadata.sourceFile, context);

    // Build skip set
    const skipNames = new Set<string>();
    skipNames.add(idName);
    relationships.forEach(rel => {
      skipNames.add(rel.relationshipName);
      if (rel.foreignKey) {
        skipNames.add(rel.foreignKey);
      }
    });

    // Collect referenced types for imports
    const referencedTypes = new Set<string>();
    relationships.forEach(rel => {
      if (rel.businessObjectName !== className) {
        referencedTypes.add(rel.businessObjectName);
      }
    });

    const lines: string[] = [];

    lines.push(`// Generated client type definitions for ${metadata.name} business object`);
    lines.push('');

    // Type-only imports for referenced BOs
    for (const refType of Array.from(referencedTypes).sort()) {
      lines.push(`import type { ${refType} } from './${kebabCase(refType)}';`);
    }
    if (referencedTypes.size > 0) lines.push('');

    // Description comment
    if (description) {
      lines.push(...description.split('\n').map(line => `// ${line}`));
      lines.push('');
    }

    lines.push(`export declare class ${className} {`);

    // id property
    lines.push(`  readonly ${idName}: ${idType};`);

    // Scalar properties
    for (const prop of properties) {
      const propName = prop.getName();
      if (skipNames.has(propName)) continue;

      let propType = prop.getTypeNode()?.getText() || prop.getType().getText();
      propType = propType.replace(' | undefined', '');
      propType = baseTypeMap.get(propType) || propType;

      const optional = prop.hasQuestionToken() ? '?' : '';
      lines.push(`  readonly ${propName}${optional}: ${propType};`);
    }

    // Mixin properties
    const mixins = resolveMixins(metadata.sourceFile, context);
    const mixinNames = mixins.map(m => m.name);
    debug('mixins %j', mixinNames);
    for (const mixin of mixins) {
      const mixinClass = getClassByBase(mixin.metadata.sourceFile, 'Mixin');
      if (!mixinClass) continue;
      for (const prop of mixinClass.getProperties()) {
        const propName = prop.getName();
        if (skipNames.has(propName)) continue;

        let propType = prop.getType().getText();
        propType = propType.replace(' | undefined', '');
        propType = baseTypeMap.get(propType) || propType;

        const optional = prop.hasQuestionToken() ? '?' : '';
        lines.push(`  readonly ${propName}${optional}: ${propType};`);
      }
    }

    // Foreign keys and relationships
    for (const rel of relationships) {
      if (rel.relationshipType === 'Belongs To' || rel.relationshipType === 'References') {
        if (rel.foreignKey && rel.foreignKeyType) {
          let fkType = String(rel.foreignKeyType);
          if (fkType === 'Number' || fkType === 'number' || fkType === 'Serial') fkType = 'number';
          else if (fkType === 'String' || fkType === 'string') fkType = 'string';
          else fkType = 'number';
          lines.push(`  readonly ${rel.foreignKey}: ${fkType};`);
        }
      }

      const relProp = properties.find(p => p.getName() === rel.relationshipName);
      const optional = relProp?.hasQuestionToken() ? '?' : '';
      const arraySuffix = rel.relationshipType === 'Has Many' ? '[]' : '';
      lines.push(`  readonly ${rel.relationshipName}${optional}: ${rel.businessObjectName}${arraySuffix};`);
    }

    // CRUD methods
    lines.push('');
    lines.push(`  static find(filter?: any): Promise<${className}[]>;`);
    lines.push(`  static findById(id: ${idType}, filter?: any): Promise<${className}>;`);
    lines.push(`  static create(data: Partial<${className}>): Promise<${className}>;`);
    lines.push(`  static updateById(id: ${idType}, data: Partial<${className}>): Promise<${className}>;`);
    lines.push(`  static deleteById(id: ${idType}): Promise<boolean>;`);

    // Behavior methods (BO + mixin behaviors)
    const parentNames = new Set([className, ...mixinNames]);
    const allBehaviors = context.listMetadata('Behavior');

    for (const behavior of allBehaviors) {
      try {
        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const parent = getBehaviorParent(behavior.sourceFile);
        if (!parent || !parentNames.has(parent)) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        if (LIFECYCLE_TYPES.has(options.type as string)) continue;

        const isInstance = options.type === 'Instance';
        const params = func.parameters || [];
        const methodParams = isInstance ? params.slice(1) : params;

        const paramStr = methodParams
          .map(p => {
            const opt = p.isOptional ? '?' : '';
            return `${p.name}${opt}: ${p.type || 'any'}`;
          })
          .join(', ');

        const returnType = func.returnType || 'any';
        const staticPrefix = isInstance ? '' : 'static ';

        lines.push(`  ${staticPrefix}${func.name}(${paramStr}): Promise<${returnType}>;`);
      } catch (err) {
        debug('error processing behavior %j: %j', behavior.name, err);
      }
    }

    lines.push('}');

    const content = lines.join('\n');
    debug('Generated client type file for %j', metadata.name);

    return content;
  }
};

export { businessObjectClientTypeGenerator };
