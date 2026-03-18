import { addBehavior } from '@apexdesigner/dsl';
import { ExportImport, ExportImportConfig } from '@mixins';
import { exportGraph } from '@functions';
import os from 'node:os';

/**
 * Export Instance
 *
 * Exports a single business object instance with its full object graph
 * as a portable JSON document.
 */
addBehavior(
  ExportImport,
  { type: 'Instance', httpMethod: 'Get' },
  async function exportInstance(Model: any, mixinOptions: ExportImportConfig, instance: any) {
    const { roots, objects } = await exportGraph(Model, [instance], mixinOptions);
    return {
      version: 1,
      exportedFrom: process.env.appUrl || os.hostname(),
      exportedAt: new Date().toISOString(),
      roots,
      objects,
    };
  },
);
