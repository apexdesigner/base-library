import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, resolveRelationships, resolveMixins, resolveIdType } from '@apexdesigner/generator';
import { getClassByBase, getDisplayName, getDescription, getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:businessObjectService');

interface PropertyEntry {
  name: string;
  type: string;
}

interface RelationshipEntry {
  name: string;
  type: string;
  kind: string;
}

interface BehaviorEntry {
  name: string;
  displayName: string;
  description: string;
  metadata: Record<string, unknown>;
}

interface BusinessObjectEntry {
  name: string;
  kebab: string;
  displayName: string;
  description: string;
  properties: PropertyEntry[];
  relationships: RelationshipEntry[];
  behaviors: BehaviorEntry[];
}

/** Convert a relationship type string to a short kind */
function toRelationshipKind(type: string): string {
  switch (type) {
    case 'Belongs To':
      return 'belongsTo';
    case 'Has Many':
      return 'hasMany';
    case 'Has One':
      return 'hasOne';
    case 'References':
      return 'references';
    default:
      return type;
  }
}

const businessObjectServiceGenerator: DesignGenerator = {
  name: 'business-object-service',
  isAggregate: true,

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
    },
    {
      metadataType: 'Project'
    }
  ],

  outputs: () => ['client/src/app/services/business-object/business-object.service.ts', 'design/@types/services/business-object.d.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    // Collect all business objects, sorted by name
    const businessObjects = context.listMetadata('BusinessObject').sort((a, b) => a.name.localeCompare(b.name));

    debug('found %d business objects', businessObjects.length);

    // Collect all behaviors once
    const allBehaviors = context.listMetadata('Behavior');

    const entries: BusinessObjectEntry[] = businessObjects.map(bo => {
      const className = pascalCase(bo.name);
      const boClass = getClassByBase(bo.sourceFile, 'BusinessObject');

      // Properties
      const relationships = resolveRelationships(bo.sourceFile, context);
      const resolvedId = resolveIdType(bo.sourceFile, context);
      const skipNames = new Set<string>([resolvedId.name]);
      relationships.forEach(rel => {
        skipNames.add(rel.relationshipName);
        if (rel.foreignKey) skipNames.add(rel.foreignKey);
      });

      const properties: PropertyEntry[] = [];

      // Add id
      let idType = resolvedId.type;
      if (idType !== 'string' && idType !== 'number') {
        idType = idType.includes('import(') || /^[A-Z]/.test(idType) ? 'string' : idType;
      }
      properties.push({ name: resolvedId.name, type: idType });

      // Add scalar properties from BO class
      if (boClass) {
        for (const prop of boClass.getProperties()) {
          const propName = prop.getName();
          if (skipNames.has(propName)) continue;
          let propType = prop.getType().getText();
          propType = propType.replace(' | undefined', '');
          properties.push({ name: propName, type: propType });
        }
      }

      // Add mixin properties
      const mixins = resolveMixins(bo.sourceFile, context);
      const mixinNames = mixins.map(m => m.name);
      for (const mixin of mixins) {
        const mixinClass = getClassByBase(mixin.metadata.sourceFile, 'Mixin');
        if (!mixinClass) continue;
        for (const prop of mixinClass.getProperties()) {
          const propName = prop.getName();
          if (skipNames.has(propName)) continue;
          let propType = prop.getType().getText();
          propType = propType.replace(' | undefined', '');
          properties.push({ name: propName, type: propType });
        }
      }

      // Add foreign keys
      for (const rel of relationships) {
        if ((rel.relationshipType === 'Belongs To' || rel.relationshipType === 'References') && rel.foreignKey) {
          properties.push({ name: rel.foreignKey, type: rel.foreignKeyType || 'number' });
        }
      }

      // Relationships
      const relationshipEntries: RelationshipEntry[] = relationships.map(rel => ({
        name: rel.relationshipName,
        type: rel.businessObjectName,
        kind: toRelationshipKind(rel.relationshipType)
      }));

      // Behaviors
      const parentNames = new Set([className, ...mixinNames]);
      const behaviorEntries: BehaviorEntry[] = [];

      for (const behavior of allBehaviors) {
        const parent = getBehaviorParent(behavior.sourceFile);
        if (!parent || !parentNames.has(parent)) continue;

        const options = getBehaviorOptions(behavior.sourceFile);
        if (!options) continue;

        const func = getBehaviorFunction(behavior.sourceFile);
        if (!func) continue;

        const behaviorClass = getClassByBase(behavior.sourceFile, 'Behavior');

        behaviorEntries.push({
          name: func.name,
          displayName: (behaviorClass && getDisplayName(behaviorClass)) || func.name,
          description: (behaviorClass && getDescription(behaviorClass)) || '',
          metadata: (options.metadata as Record<string, unknown>) || {}
        });
      }

      behaviorEntries.sort((a, b) => a.name.localeCompare(b.name));

      return {
        name: className,
        kebab: kebabCase(bo.name),
        displayName: (boClass && getDisplayName(boClass)) || className,
        description: (boClass && getDescription(boClass)) || '',
        properties,
        relationships: relationshipEntries,
        behaviors: behaviorEntries
      };
    });

    // --- Runtime service ---
    const lines: string[] = [];

    lines.push("import { Injectable } from '@angular/core';");
    lines.push("import type { PersistedFormGroup } from '../../business-objects/persisted-form-group';");
    lines.push("import type { PersistedFormArray } from '../../business-objects/persisted-form-group';");
    lines.push("import type { PersistedArray } from '../../business-objects/persisted-form-group';");
    lines.push('import createDebug from "debug";');
    lines.push('');
    lines.push(`const debug = createDebug("${debugNamespace}:BusinessObjectService");`);
    lines.push('');

    // Interfaces
    lines.push('export interface BusinessObjectProperty {');
    lines.push('  name: string;');
    lines.push('  type: string;');
    lines.push('}');
    lines.push('');
    lines.push('export interface BusinessObjectRelationship {');
    lines.push('  name: string;');
    lines.push('  type: string;');
    lines.push("  kind: 'belongsTo' | 'hasMany' | 'hasOne' | 'references';");
    lines.push('}');
    lines.push('');
    lines.push('export interface BusinessObjectBehavior {');
    lines.push('  name: string;');
    lines.push('  displayName: string;');
    lines.push('  description: string;');
    lines.push('  metadata?: Record<string, unknown>;');
    lines.push('}');
    lines.push('');
    lines.push('export interface BusinessObjectMetadata {');
    lines.push('  name: string;');
    lines.push('  displayName: string;');
    lines.push('  description: string;');
    lines.push('  properties: readonly BusinessObjectProperty[];');
    lines.push('  relationships: readonly BusinessObjectRelationship[];');
    lines.push('  behaviors: readonly BusinessObjectBehavior[];');
    lines.push('}');
    lines.push('');

    // toKebab helper
    lines.push('function toKebab(name: string): string {');
    lines.push("  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();");
    lines.push('}');
    lines.push('');

    lines.push("@Injectable({ providedIn: 'root' })");
    lines.push('export class BusinessObjectService {');

    // names array
    const namesList = entries.map(e => `'${e.name}'`).join(', ');
    lines.push(`  readonly names = [${namesList}] as const;`);
    lines.push('');

    // metadata array
    lines.push('  readonly metadata: readonly BusinessObjectMetadata[] = [');
    for (const entry of entries) {
      const propsStr = entry.properties.map(p => `{ name: '${p.name}', type: '${p.type}' }`).join(', ');
      const relsStr = entry.relationships.map(r => `{ name: '${r.name}', type: '${r.type}', kind: '${r.kind}' }`).join(', ');
      const behaviorsStr = entry.behaviors
        .map(b => {
          const metadataStr = Object.keys(b.metadata).length > 0 ? `, metadata: ${JSON.stringify(b.metadata)}` : '';
          return `{ name: '${b.name}', displayName: '${b.displayName}', description: '${b.description.replace(/'/g, "\\'").replace(/\n/g, ' ')}'${metadataStr} }`;
        })
        .join(', ');

      lines.push('    {');
      lines.push(`      name: '${entry.name}',`);
      lines.push(`      displayName: '${entry.displayName}',`);
      lines.push(`      description: '${entry.description.replace(/'/g, "\\'").replace(/\n/g, ' ')}',`);
      lines.push(`      properties: [${propsStr}],`);
      lines.push(`      relationships: [${relsStr}],`);
      lines.push(`      behaviors: [${behaviorsStr}],`);
      lines.push('    },');
    }
    lines.push('  ];');
    lines.push('');

    // getMetadata method
    lines.push('  getMetadata(name: string): BusinessObjectMetadata | undefined {');
    lines.push('    return this.metadata.find(m => m.name === name);');
    lines.push('  }');
    lines.push('');

    // loadFormGroup method
    lines.push('  async loadFormGroup(entityName: string, options?: any): Promise<PersistedFormGroup> {');
    lines.push('    debug("loadFormGroup %s", entityName);');
    lines.push('    const kebab = toKebab(entityName);');
    lines.push('    const m = await import(`../../business-objects/${kebab}-form-group`);');
    lines.push('    return new m[`${entityName}FormGroup`](options);');
    lines.push('  }');
    lines.push('');

    // loadFormArray method
    lines.push('  async loadFormArray(entityName: string, options?: any): Promise<PersistedFormArray> {');
    lines.push('    debug("loadFormArray %s", entityName);');
    lines.push('    const kebab = toKebab(entityName);');
    lines.push('    const m = await import(`../../business-objects/${kebab}-form-group`);');
    lines.push('    return new m[`${entityName}FormArray`](options);');
    lines.push('  }');
    lines.push('');

    // loadPersistedArray method
    lines.push('  async loadPersistedArray(entityName: string, options?: any): Promise<PersistedArray> {');
    lines.push('    debug("loadPersistedArray %s", entityName);');
    lines.push('    const kebab = toKebab(entityName);');
    lines.push('    const m = await import(`../../business-objects/${kebab}-form-group`);');
    lines.push('    return new m[`${entityName}PersistedArray`](options);');
    lines.push('  }');
    lines.push('');

    // loadEntity method
    lines.push('  async loadEntity(entityName: string): Promise<any> {');
    lines.push('    debug("loadEntity %s", entityName);');
    lines.push('    const kebab = toKebab(entityName);');
    lines.push('    const m = await import(`../../business-objects/${kebab}-form-group`);');
    lines.push('    return m[entityName];');
    lines.push('  }');

    lines.push('}');

    const serviceContent = lines.join('\n') + '\n';

    // --- Type declaration ---
    const typeLines: string[] = [];
    typeLines.push("import type { PersistedFormGroup } from '@business-objects-client';");
    typeLines.push("import type { PersistedFormArray } from '@business-objects-client';");
    typeLines.push("import type { PersistedArray } from '@business-objects-client';");
    typeLines.push('');
    typeLines.push('export interface BusinessObjectProperty {');
    typeLines.push('  name: string;');
    typeLines.push('  type: string;');
    typeLines.push('}');
    typeLines.push('');
    typeLines.push('export interface BusinessObjectRelationship {');
    typeLines.push('  name: string;');
    typeLines.push('  type: string;');
    typeLines.push("  kind: 'belongsTo' | 'hasMany' | 'hasOne' | 'references';");
    typeLines.push('}');
    typeLines.push('');
    typeLines.push('export interface BusinessObjectBehavior {');
    typeLines.push('  name: string;');
    typeLines.push('  displayName: string;');
    typeLines.push('  description: string;');
    typeLines.push('  metadata?: Record<string, unknown>;');
    typeLines.push('}');
    typeLines.push('');
    typeLines.push('export interface BusinessObjectMetadata {');
    typeLines.push('  name: string;');
    typeLines.push('  displayName: string;');
    typeLines.push('  description: string;');
    typeLines.push('  properties: readonly BusinessObjectProperty[];');
    typeLines.push('  relationships: readonly BusinessObjectRelationship[];');
    typeLines.push('  behaviors: readonly BusinessObjectBehavior[];');
    typeLines.push('}');
    typeLines.push('');
    typeLines.push('export declare class BusinessObjectService {');
    typeLines.push('  readonly names: readonly string[];');
    typeLines.push('  readonly metadata: readonly BusinessObjectMetadata[];');
    typeLines.push('  getMetadata(name: string): BusinessObjectMetadata | undefined;');
    typeLines.push('  loadFormGroup(entityName: string, options?: any): Promise<PersistedFormGroup>;');
    typeLines.push('  loadFormArray(entityName: string, options?: any): Promise<PersistedFormArray>;');
    typeLines.push('  loadPersistedArray(entityName: string, options?: any): Promise<PersistedArray>;');
    typeLines.push('  loadEntity(entityName: string): Promise<any>;');
    typeLines.push('}');

    const typeContent = typeLines.join('\n') + '\n';

    debug('Generated business object service with %d business objects', entries.length);

    const outputs = new Map<string, string>();
    outputs.set('client/src/app/services/business-object/business-object.service.ts', serviceContent);
    outputs.set('design/@types/services/business-object.d.ts', typeContent);

    return outputs;
  }
};

export { businessObjectServiceGenerator };
