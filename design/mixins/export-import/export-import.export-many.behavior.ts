import { addBehavior } from '@apexdesigner/dsl';
import { ExportImport, ExportImportConfig } from '@mixins';
import { exportGraph } from '@functions';
import os from 'node:os';

/**
 * Export Many
 *
 * Exports every instance matching a where filter, combining them
 * into a single portable JSON document with deduplicated references.
 */
addBehavior(
  ExportImport,
  { type: 'Class', httpMethod: 'Post' },
  async function exportMany(Model: any, mixinOptions: ExportImportConfig, body: any) {
    const instances = await Model.find({ where: body.where });
    const { roots, objects } = await exportGraph(Model, instances, mixinOptions);
    return {
      version: 1,
      exportedFrom: process.env.appUrl || os.hostname(),
      exportedAt: new Date().toISOString(),
      roots,
      objects,
    };
  },
);
