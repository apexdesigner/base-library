import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';
import { setSystemRequest, setImporting } from '@functions';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:ExportImport:import');

/**
 * Import
 *
 * Imports an export document into the database. Resolves references
 * by anchor, creates or updates roots, and synchronizes children.
 * Supports dry run mode to preview changes without persisting.
 */
addAppBehavior(
  { type: 'Class Behavior', httpMethod: 'Post', path: '/api/import' },
  async function importData(body: any) {
    const { getRelationshipMetadata, isRelationship, getUniqueConstraints } = await import('@apexdesigner/schema-tools');

    const document = body.document || body;
    const dryRun = body.dryRun === true;

    debug('importing document version %j, dryRun %j', document.version, dryRun);

    if (!document.roots || !document.objects) {
      throw new Error('Invalid import document: missing roots or objects');
    }

    // Build tracking map: objects[type][sourceId] → { data, _targetId }
    const tracking: Record<string, Record<string, { data: any; _targetId: any }>> = {};
    for (const [type, entries] of Object.entries(document.objects as Record<string, Record<string, any>>)) {
      tracking[type] = {};
      for (const [sourceId, data] of Object.entries(entries as Record<string, any>)) {
        tracking[type][sourceId] = { data: { ...data }, _targetId: null };
      }
    }

    // Classify types: root, child, reference
    const rootTypes = new Set(Object.keys(document.roots as Record<string, string[]>));
    const childTypes = new Set<string>();
    const allTypes = new Set(Object.keys(document.objects as Record<string, any>));

    // Walk root schemas to find child types
    for (const rootType of rootTypes) {
      collectChildTypes(rootType, childTypes);
    }

    function collectChildTypes(entityName: string, collected: Set<string>): void {
      const BOClass = (App.businessObjects as any)[entityName];
      if (!BOClass) return;

      const shape = BOClass.schema.shape as Record<string, any>;
      for (const [fieldName, fieldSchema] of Object.entries(shape)) {
        if (!isRelationship(fieldSchema as any)) continue;
        const relMeta = getRelationshipMetadata(fieldSchema as any);
        if (!relMeta || !relMeta.targetEntity || !relMeta.foreignKey) continue;

        if (relMeta.relationshipType !== 'hasMany' && relMeta.relationshipType !== 'hasOne') continue;

        // Check if target has belongsTo back
        const targetBOClass = (App.businessObjects as any)[relMeta.targetEntity];
        if (!targetBOClass) continue;

        // Check excludeRelationships
        const mixinOpts = BOClass.mixinOptions?.exportImport;
        if (mixinOpts?.excludeRelationships?.includes(fieldName)) continue;

        let isBelongsToParent = false;
        const targetShape = targetBOClass.schema.shape as Record<string, any>;
        for (const [, targetFieldSchema] of Object.entries(targetShape)) {
          const targetRelMeta = getRelationshipMetadata(targetFieldSchema as any);
          if (targetRelMeta && targetRelMeta.relationshipType === 'belongsTo' && targetRelMeta.targetEntity === entityName) {
            isBelongsToParent = true;
            break;
          }
        }

        if (isBelongsToParent && allTypes.has(relMeta.targetEntity)) {
          collected.add(relMeta.targetEntity);
          collectChildTypes(relMeta.targetEntity, collected);
        }
      }
    }

    const referenceTypes = new Set<string>();
    for (const type of allTypes) {
      if (!rootTypes.has(type) && !childTypes.has(type)) {
        referenceTypes.add(type);
      }
    }

    debug('rootTypes %j, childTypes %j, referenceTypes %j',
      Array.from(rootTypes), Array.from(childTypes), Array.from(referenceTypes));

    // Summary tracking
    const summary = { created: 0, updated: 0, resolved: 0, removed: 0 };

    // Get a data source for transactions
    const firstRootType = Array.from(rootTypes)[0];
    const firstBOClass = (App.businessObjects as any)[firstRootType];
    if (!firstBOClass) throw new Error(`Unknown root type: ${firstRootType}`);
    const dataSource = firstBOClass.dataSource;

    const dryRunMarker = Symbol('dryRun');

    try {
      await setSystemRequest(async () => {
        await setImporting(async () => {
          await dataSource.transaction(async () => {
            // --- Iterative multi-pass resolution ---
            let resolvedThisPass = true;
            let passes = 0;

            while (resolvedThisPass && passes < 100) {
              resolvedThisPass = false;
              passes++;
              debug('pass %d', passes);

              for (const [type, entries] of Object.entries(tracking)) {
                const BOClass = (App.businessObjects as any)[type];
                if (!BOClass) continue;

                const schema = BOClass.schema;

                for (const [sourceId, entry] of Object.entries(entries)) {
                  if (entry._targetId !== null) continue;

                  // Check if all FK dependencies are resolved
                  const fkDeps = getFKDependencies(schema, type, sourceId);
                  const allResolved = fkDeps.every(dep => {
                    const depEntry = tracking[dep.targetType]?.[String(dep.sourceValue)];
                    return depEntry && depEntry._targetId !== null;
                  });

                  if (!allResolved) continue;

                  // Build data with remapped FKs
                  const remappedData = { ...entry.data };
                  for (const dep of fkDeps) {
                    const depEntry = tracking[dep.targetType]?.[String(dep.sourceValue)];
                    if (depEntry) {
                      remappedData[dep.fkField] = depEntry._targetId;
                    }
                  }

                  if (referenceTypes.has(type)) {
                    // Resolve reference by anchor
                    const anchor = buildAnchorWhere(BOClass, remappedData);
                    debug('resolving reference %s:%s with anchor %j', type, sourceId, anchor);
                    const found = await BOClass.findOne({ where: anchor });
                    if (!found) {
                      throw new Error(`Reference not found: ${type} with anchor ${JSON.stringify(anchor)}`);
                    }
                    entry._targetId = found.id;
                    summary.resolved++;
                  } else if (rootTypes.has(type)) {
                    // Find or create root
                    const anchor = buildAnchorWhere(BOClass, remappedData);
                    debug('processing root %s:%s with anchor %j', type, sourceId, anchor);
                    const existing = await BOClass.findOne({ where: anchor });
                    if (existing) {
                      const updateData = { ...remappedData };
                      for (const [key, value] of Object.entries(updateData)) {
                        if (value === null || value === undefined) delete updateData[key];
                      }
                      await BOClass.updateById(existing.id, updateData);
                      entry._targetId = existing.id;
                      summary.updated++;
                    } else {
                      const created = await BOClass.create(remappedData);
                      entry._targetId = created.id;
                      summary.created++;
                    }
                  } else {
                    // Child: create or match/update
                    const anchor = buildAnchorWhere(BOClass, remappedData);
                    debug('processing child %s:%s with anchor %j', type, sourceId, anchor);
                    const existing = await BOClass.findOne({ where: anchor });
                    if (existing) {
                      await BOClass.updateById(existing.id, remappedData);
                      entry._targetId = existing.id;
                      summary.updated++;
                    } else {
                      const created = await BOClass.create(remappedData);
                      entry._targetId = created.id;
                      summary.created++;
                    }
                  }

                  resolvedThisPass = true;
                }
              }
            }

            // Check for unresolved items
            const unresolved: string[] = [];
            for (const [type, entries] of Object.entries(tracking)) {
              for (const [sourceId, entry] of Object.entries(entries)) {
                if (entry._targetId === null) {
                  unresolved.push(`${type}:${sourceId}`);
                }
              }
            }
            if (unresolved.length > 0) {
              throw new Error(`Unresolved items after ${passes} passes: ${unresolved.join(', ')}`);
            }

            // --- Child synchronization: remove DB children not in import ---
            for (const rootType of rootTypes) {
              const rootBOClass = (App.businessObjects as any)[rootType];
              if (!rootBOClass) continue;

              const rootIds = (document.roots as Record<string, string[]>)[rootType] || [];
              for (const rootSourceId of rootIds) {
                const rootEntry = tracking[rootType]?.[rootSourceId];
                if (!rootEntry) continue;

                await syncChildren(rootBOClass, rootEntry._targetId, rootType, rootSourceId);
              }
            }

            async function syncChildren(
              parentBOClass: any,
              parentTargetId: any,
              parentType: string,
              parentSourceId: string,
            ): Promise<void> {
              const mixinOpts = parentBOClass.mixinOptions?.exportImport;
              const shape = parentBOClass.schema.shape as Record<string, any>;

              for (const [fieldName, fieldSchema] of Object.entries(shape)) {
                if (!isRelationship(fieldSchema as any)) continue;
                const relMeta = getRelationshipMetadata(fieldSchema as any);
                if (!relMeta || !relMeta.targetEntity || !relMeta.foreignKey) continue;
                if (relMeta.relationshipType !== 'hasMany' && relMeta.relationshipType !== 'hasOne') continue;

                // Skip excluded relationships
                if (mixinOpts?.excludeRelationships?.includes(fieldName)) continue;

                const targetType = relMeta.targetEntity;
                if (!childTypes.has(targetType)) continue;

                const targetBOClass = (App.businessObjects as any)[targetType];
                if (!targetBOClass) continue;

                const fk = relMeta.foreignKey;

                // Find all DB children for this parent
                const dbChildren = await targetBOClass.find({ where: { [fk]: parentTargetId } });

                // Find imported children (those in tracking with this parent FK)
                const importedTargetIds = new Set<any>();
                const targetTracking = tracking[targetType];
                if (targetTracking) {
                  for (const [, entry] of Object.entries(targetTracking)) {
                    if (entry._targetId !== null && entry.data[fk] !== undefined) {
                      const remappedParentId = tracking[parentType]?.[parentSourceId]?._targetId;
                      if (remappedParentId !== undefined) {
                        importedTargetIds.add(entry._targetId);
                      }
                    }
                  }
                }

                // Delete children not in import
                for (const dbChild of dbChildren) {
                  if (!importedTargetIds.has(dbChild.id)) {
                    debug('removing orphaned child %s:%s', targetType, dbChild.id);
                    await targetBOClass.deleteById(dbChild.id);
                    summary.removed++;
                  }
                }

                // Recurse into grandchildren
                if (targetTracking) {
                  for (const [childSourceId, childEntry] of Object.entries(targetTracking)) {
                    if (childEntry._targetId !== null) {
                      await syncChildren(targetBOClass, childEntry._targetId, targetType, childSourceId);
                    }
                  }
                }
              }
            }

            debug('import complete: %j', summary);

            if (dryRun) {
              throw { [dryRunMarker]: true, summary };
            }
          });
        });
      });
    } catch (err: any) {
      if (err?.[dryRunMarker]) {
        return { dryRun: true, summary: err.summary };
      }
      throw err;
    }

    return { dryRun: false, summary };

    // --- Helper functions ---

    function getFKDependencies(
      schema: any,
      type: string,
      sourceId: string,
    ): Array<{ fkField: string; targetType: string; sourceValue: any }> {
      const deps: Array<{ fkField: string; targetType: string; sourceValue: any }> = [];
      const entry = tracking[type]?.[sourceId];
      if (!entry) return deps;

      const shape = schema.shape as Record<string, any>;
      for (const [, fieldSchema] of Object.entries(shape)) {
        if (!isRelationship(fieldSchema as any)) continue;
        const relMeta = getRelationshipMetadata(fieldSchema as any);
        if (!relMeta || !relMeta.foreignKey || !relMeta.targetEntity) continue;
        if (relMeta.relationshipType !== 'belongsTo' && relMeta.relationshipType !== 'references') continue;

        const fkValue = entry.data[relMeta.foreignKey];
        if (fkValue == null) continue;

        // Only track as dependency if the referenced object is in the import
        if (tracking[relMeta.targetEntity]?.[String(fkValue)]) {
          deps.push({
            fkField: relMeta.foreignKey,
            targetType: relMeta.targetEntity,
            sourceValue: fkValue,
          });
        }
      }

      return deps;
    }

    function buildAnchorWhere(BOClass: any, data: Record<string, any>): Record<string, any> {
      const schema = BOClass.schema;
      const entityName = BOClass.entityName;

      // Check for configured anchor override
      const mixinOpts = BOClass.mixinOptions?.exportImport;
      if (mixinOpts?.referenceAnchors?.[entityName]) {
        const anchorFields = mixinOpts.referenceAnchors[entityName];
        const where: Record<string, any> = {};
        for (const field of anchorFields) {
          if (data[field] !== undefined) where[field] = data[field];
        }
        return where;
      }

      // Use unique constraints if available
      const constraints = getUniqueConstraints(schema);
      if (constraints.length > 0) {
        const where: Record<string, any> = {};
        for (const field of constraints[0].fields) {
          if (data[field] !== undefined) where[field] = data[field];
        }
        return where;
      }

      // Fallback: all non-null scalar properties
      const where: Record<string, any> = {};
      const shape = schema.shape as Record<string, any>;
      for (const [key, value] of Object.entries(data)) {
        if (value != null && !isRelationship(shape[key] as any)) {
          where[key] = value;
        }
      }
      return where;
    }
  },
);
