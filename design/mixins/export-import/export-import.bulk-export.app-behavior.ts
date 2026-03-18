import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';
import { exportGraph } from '@functions';
import os from 'node:os';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:ExportImport:bulkExport');

/**
 * Bulk Export
 *
 * Exports multiple entity types in a single request. Accepts a map
 * of entity names to where filters. Only entities with the Export
 * Import mixin applied can be included.
 */
addAppBehavior(
  { type: 'Class Behavior', httpMethod: 'Post', path: '/api/bulk-export' },
  async function bulkExport(body: any) {
    const roots: Record<string, string[]> = {};
    const objects: Record<string, Record<string, any>> = {};

    for (const [entityName, where] of Object.entries(body)) {
      const BOClass = (App.businessObjects as any)[entityName];
      if (!BOClass) {
        throw new Error(`Unknown entity: ${entityName}`);
      }

      const mixinOptions = BOClass.mixinOptions?.exportImport;
      if (!mixinOptions) {
        throw new Error(`Entity ${entityName} does not have the Export Import mixin applied`);
      }

      debug('exporting %s with filter %j', entityName, where);

      const instances = await BOClass.find({ where });
      const result = await exportGraph(BOClass, instances, mixinOptions);

      // Merge roots
      for (const [type, ids] of Object.entries(result.roots)) {
        if (!roots[type]) roots[type] = [];
        roots[type].push(...ids);
      }

      // Merge objects (deduplication happens in exportGraph via visited set)
      for (const [type, entries] of Object.entries(result.objects)) {
        if (!objects[type]) objects[type] = {};
        Object.assign(objects[type], entries);
      }
    }

    return {
      version: 1,
      exportedFrom: process.env.appUrl || os.hostname(),
      exportedAt: new Date().toISOString(),
      roots,
      objects,
    };
  },
);
