import { addFunction, addTest } from '@apexdesigner/dsl';
import { App } from '@app';
import { exportGraph } from '@functions';
import { ExportImportConfig } from '@mixins';
import createDebug from 'debug';
import { expect } from 'vitest';

const debug = createDebug('BaseLibrary:ExportImport:exportGraph');

/**
 * Export Graph
 *
 * Traverses the object graph starting from one or more root instances,
 * collecting children (belongs-to-parent) recursively and referenced
 * objects with their identifying anchors. Returns a normalized map
 * suitable for the export file format.
 *
 * @param Model - The business object class of the root instances
 * @param instances - The root instances to export
 * @param mixinOptions - Export configuration from the mixin
 * @returns The roots map and normalized objects map
 */
addFunction(
  { layer: 'Server' },
  async function exportGraph(
    Model: any,
    instances: any[],
    mixinOptions: ExportImportConfig,
  ): Promise<{ roots: Record<string, string[]>; objects: Record<string, Record<string, any>> }> {
    const { getRelationshipMetadata, isRelationship, getUniqueConstraints, withoutRelationships } = await import('@apexdesigner/schema-tools');

    const roots: Record<string, string[]> = {};
    const objects: Record<string, Record<string, any>> = {};
    const visited = new Set<string>();

    const entityName = Model.entityName;
    roots[entityName] = instances.map(inst => String(inst.id));

    for (const instance of instances) {
      await collectObject(Model, instance, objects, visited, mixinOptions, false);
    }

    async function collectObject(
      BOClass: any,
      instance: any,
      objects: Record<string, Record<string, any>>,
      visited: Set<string>,
      config: ExportImportConfig,
      isReference: boolean,
    ): Promise<void> {
      const name = BOClass.entityName;
      const id = String(instance.id);
      const key = `${name}:${id}`;

      if (visited.has(key)) return;
      visited.add(key);

      debug('collecting %s %s (isReference: %j)', name, id, isReference);

      const schema = BOClass.schema;

      if (!objects[name]) objects[name] = {};

      if (isReference) {
        // For references, store only anchor-relevant fields
        const anchorData = buildAnchorData(BOClass, instance, config);
        objects[name][id] = anchorData;
      } else {
        // For roots and children, store all scalar data minus id and excludeProperties
        const scalarData = withoutRelationships(toPlainObject(instance), schema);
        delete scalarData.id;
        if (config.excludeProperties) {
          for (const prop of config.excludeProperties) {
            delete scalarData[prop];
          }
        }
        // Remove hidden fields that are not foreign keys (like 'mixins')
        // Keep FK fields (they end in 'Id' and are needed for import)
        for (const [fieldName, fieldSchema] of Object.entries(schema.shape as Record<string, any>)) {
          if (isHidden(fieldSchema) && !fieldName.endsWith('Id') && fieldName !== 'id') {
            delete scalarData[fieldName];
          }
        }
        objects[name][id] = scalarData;
      }

      // Walk relationships
      for (const [fieldName, fieldSchema] of Object.entries(schema.shape as Record<string, any>)) {
        if (!isRelationship(fieldSchema)) continue;

        const relMeta = getRelationshipMetadata(fieldSchema);
        if (!relMeta) continue;

        // Skip excluded relationships
        if (config.excludeRelationships?.includes(fieldName)) {
          // Also remove the FK from the exported data if it's a reference
          if (relMeta.foreignKey && objects[name]?.[id]) {
            delete objects[name][id][relMeta.foreignKey];
          }
          continue;
        }

        if (!relMeta.targetEntity || !relMeta.foreignKey) continue;
        const targetBOClass = (App.businessObjects as any)[relMeta.targetEntity];
        if (!targetBOClass) continue;

        if (relMeta.relationshipType === 'hasMany' || relMeta.relationshipType === 'hasOne') {
          if (isReference) continue; // Don't recurse into children of references

          // Check if the target has a belongsTo back to this entity
          const targetSchema = targetBOClass.schema;
          let isBelongsToParent = false;
          for (const [, targetFieldSchema] of Object.entries(targetSchema.shape as Record<string, any>)) {
            const targetRelMeta = getRelationshipMetadata(targetFieldSchema as any);
            if (targetRelMeta && targetRelMeta.relationshipType === 'belongsTo' && targetRelMeta.targetEntity === name) {
              isBelongsToParent = true;
              break;
            }
          }

          if (!isBelongsToParent) continue;

          // Load children
          const fk = relMeta.foreignKey;
          const children = relMeta.relationshipType === 'hasMany'
            ? await targetBOClass.find({ where: { [fk]: instance.id } })
            : [await targetBOClass.findOne({ where: { [fk]: instance.id } })].filter(Boolean);

          debug('found %d children of type %s for %s %s', children.length, relMeta.targetEntity, name, id);

          // Get the target's mixin options if it has ExportImport applied
          const targetConfig = targetBOClass.mixinOptions?.exportImport || {};
          const mergedConfig = {
            excludeProperties: [...(config.excludeProperties || []), ...(targetConfig.excludeProperties || [])],
            excludeRelationships: targetConfig.excludeRelationships || [],
            referenceAnchors: { ...config.referenceAnchors, ...targetConfig.referenceAnchors },
          };

          for (const child of children) {
            await collectObject(targetBOClass, child, objects, visited, mergedConfig, false);
          }
        } else if (relMeta.relationshipType === 'belongsTo' || relMeta.relationshipType === 'references') {
          // Collect the referenced object
          const fkValue = instance[relMeta.foreignKey];
          if (fkValue == null) continue;

          const refInstance = await targetBOClass.findById(fkValue);
          await collectObject(targetBOClass, refInstance, objects, visited, config, true);
        }
      }
    }

    function buildAnchorData(
      BOClass: any,
      instance: any,
      config: ExportImportConfig,
    ): Record<string, any> {
      const schema = BOClass.schema;
      const name = BOClass.entityName;

      // Check for configured anchor override
      if (config.referenceAnchors?.[name]) {
        const anchorFields = config.referenceAnchors[name];
        const data: Record<string, any> = {};
        for (const field of anchorFields) {
          if (instance[field] !== undefined) {
            data[field] = instance[field];
          }
        }
        return data;
      }

      // Use unique constraints if available
      const constraints = getUniqueConstraints(schema);
      if (constraints.length > 0) {
        const data: Record<string, any> = {};
        for (const field of constraints[0].fields) {
          if (instance[field] !== undefined) {
            data[field] = instance[field];
          }
        }
        return data;
      }

      // Fallback: all non-null scalar properties except id and FK fields
      const scalarData = withoutRelationships(toPlainObject(instance), schema);
      delete scalarData.id;
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(scalarData)) {
        if (value != null && !key.endsWith('Id') && !isHidden(schema.shape[key])) {
          result[key] = value;
        }
      }
      // Include FK fields that are part of identifying the reference
      for (const [key, value] of Object.entries(scalarData)) {
        if (value != null && key.endsWith('Id')) {
          result[key] = value;
        }
      }
      return result;
    }

    function isHidden(fieldSchema: any): boolean {
      try {
        const meta = fieldSchema?._def?.metadata || fieldSchema?._def?.checks;
        if (Array.isArray(meta)) {
          return meta.some((m: any) => m['x-hidden'] === true);
        }
        // Check JSON schema metadata
        const jsonSchema = fieldSchema?.meta?.();
        return jsonSchema?.['x-hidden'] === true;
      } catch {
        return false;
      }
    }

    function toPlainObject(instance: any): Record<string, any> {
      return JSON.parse(JSON.stringify(instance));
    }

    return { roots, objects };
  },
);

addTest('should export a root with its children and references', async () => {
  const { getRelationshipMetadata, isRelationship } = await import('@apexdesigner/schema-tools');

  // Use the actual test BOs: TestItem has a TestItemDetail child and TestSetting reference
  const TestItem = (App.businessObjects as any).TestItem;
  const TestItemDetail = (App.businessObjects as any).TestItemDetail;
  const TestSetting = (App.businessObjects as any).TestSetting;

  // Create test data
  const setting = await TestSetting.create({ name: 'export-test-setting' });
  const item = await TestItem.create({ name: 'Export Test', testSettingId: setting.id });
  const detail = await TestItemDetail.create({ notes: 'Detail notes', priority: 1, testItemId: item.id });

  const result = await exportGraph(TestItem, [item], {});

  // Should have the root
  expect(result.roots.TestItem).toContain(String(item.id));

  // Should have the root object data
  expect(result.objects.TestItem[String(item.id)].name).toBe('Export Test');

  // Should have the child
  expect(result.objects.TestItemDetail).toBeDefined();
  expect(result.objects.TestItemDetail[String(detail.id)].notes).toBe('Detail notes');

  // Should have the reference
  expect(result.objects.TestSetting).toBeDefined();
  expect(result.objects.TestSetting[String(setting.id)]).toBeDefined();

  // Root object should not have id
  expect(result.objects.TestItem[String(item.id)].id).toBeUndefined();

  // Cleanup
  await TestItemDetail.deleteById(detail.id);
  await TestItem.deleteById(item.id);
  await TestSetting.deleteById(setting.id);
});

addTest('should respect excludeProperties', async () => {
  const TestItem = (App.businessObjects as any).TestItem;

  const item = await TestItem.create({ name: 'Exclude Test', description: 'should be excluded' });

  const result = await exportGraph(TestItem, [item], { excludeProperties: ['description'] });

  expect(result.objects.TestItem[String(item.id)].name).toBe('Exclude Test');
  expect(result.objects.TestItem[String(item.id)].description).toBeUndefined();

  await TestItem.deleteById(item.id);
});

addTest('should respect excludeRelationships', async () => {
  const TestItem = (App.businessObjects as any).TestItem;
  const TestItemDetail = (App.businessObjects as any).TestItemDetail;

  const item = await TestItem.create({ name: 'Exclude Rel Test' });
  const detail = await TestItemDetail.create({ notes: 'should not appear', testItemId: item.id });

  const result = await exportGraph(TestItem, [item], { excludeRelationships: ['testItemDetail'] });

  // Child should not be collected
  expect(result.objects.TestItemDetail).toBeUndefined();

  await TestItemDetail.deleteById(detail.id);
  await TestItem.deleteById(item.id);
});

addTest('should deduplicate references across multiple roots', async () => {
  const TestItem = (App.businessObjects as any).TestItem;
  const TestSetting = (App.businessObjects as any).TestSetting;

  const setting = await TestSetting.create({ name: 'shared-setting' });
  const item1 = await TestItem.create({ name: 'Item 1', testSettingId: setting.id });
  const item2 = await TestItem.create({ name: 'Item 2', testSettingId: setting.id });

  const result = await exportGraph(TestItem, [item1, item2], {});

  // Should have both roots
  expect(result.roots.TestItem).toHaveLength(2);

  // Reference should appear only once
  const settingEntries = Object.keys(result.objects.TestSetting || {});
  expect(settingEntries).toHaveLength(1);

  await TestItem.deleteById(item1.id);
  await TestItem.deleteById(item2.id);
  await TestSetting.deleteById(setting.id);
});
