import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions, getModuleLevelCall } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:appBehaviorService');

interface AppBehaviorEntry {
  name: string;
  displayName: string;
  description: string;
  type: string;
  layer?: string;
  httpMethod?: string;
  path?: string;
  roles?: string[];
  stage?: string;
  sequence?: number;
  eventName?: string;
  metadata?: Record<string, unknown>;
}

/** Extract display name and description from the JSDoc on addAppBehavior() */
function extractJsDoc(metadata: DesignMetadata): { displayName?: string; description?: string } {
  const call = getModuleLevelCall(metadata.sourceFile, 'addAppBehavior');
  if (!call) return {};

  const statement = call.getParent();
  if (!statement || !Node.isExpressionStatement(statement)) return {};

  const docs = statement.getJsDocs();
  const doc = docs[0];
  if (!doc) return {};

  const text = doc.getDescription().trim();
  if (!text) return {};

  const lines = text.split('\n');
  const displayName = lines[0]?.trim();
  const description = lines.length > 1 ? lines.slice(1).join('\n').trim() : undefined;

  return { displayName: displayName || undefined, description };
}

const appBehaviorServiceGenerator: DesignGenerator = {
  name: 'app-behavior-service',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'AppBehavior'
    },
    {
      metadataType: 'Project'
    }
  ],

  outputs: () => [
    'client/src/app/services/app-behavior/app-behavior.service.ts',
    'design/@types/services/app-behavior.d.ts'
  ],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Collect all app behaviors, sorted by name
    const appBehaviors = context.listMetadata('AppBehavior').sort((a, b) => a.name.localeCompare(b.name));

    debug('found %d app behaviors', appBehaviors.length);

    const entries: AppBehaviorEntry[] = [];

    for (const ab of appBehaviors) {
      const options = getBehaviorOptions(ab.sourceFile);
      if (!options) continue;

      const func = getBehaviorFunction(ab.sourceFile);
      if (!func) continue;

      const jsDoc = extractJsDoc(ab);

      const entry: AppBehaviorEntry = {
        name: func.name,
        displayName: jsDoc.displayName || func.name,
        description: jsDoc.description || '',
        type: options.type as string
      };

      if (options.layer) entry.layer = options.layer as string;
      if (options.httpMethod) entry.httpMethod = options.httpMethod as string;
      if (options.path) entry.path = options.path as string;
      if (Array.isArray(options.roles) && options.roles.length > 0) {
        entry.roles = options.roles as string[];
      }
      if (options.stage) entry.stage = options.stage as string;
      if (options.sequence != null) entry.sequence = options.sequence as number;
      if (options.eventName) entry.eventName = options.eventName as string;
      if (options.metadata && Object.keys(options.metadata as object).length > 0) {
        entry.metadata = options.metadata as Record<string, unknown>;
      }

      entries.push(entry);
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    // --- Runtime service ---
    const lines: string[] = [];

    lines.push("import { Injectable } from '@angular/core';");
    lines.push('');

    // AppBehaviorEntry interface
    lines.push('export interface AppBehaviorEntry {');
    lines.push('  name: string;');
    lines.push('  displayName: string;');
    lines.push('  description: string;');
    lines.push('  type: string;');
    lines.push("  layer?: 'Client' | 'Server';");
    lines.push('  httpMethod?: string;');
    lines.push('  path?: string;');
    lines.push('  roles?: readonly string[];');
    lines.push('  stage?: string;');
    lines.push('  sequence?: number;');
    lines.push('  eventName?: string;');
    lines.push('  metadata?: Record<string, unknown>;');
    lines.push('}');
    lines.push('');

    lines.push("@Injectable({ providedIn: 'root' })");
    lines.push('export class AppBehaviorService {');

    // metadata array
    lines.push('  readonly behaviors: readonly AppBehaviorEntry[] = [');
    for (const entry of entries) {
      lines.push('    {');
      lines.push(`      name: '${entry.name}',`);
      lines.push(`      displayName: '${entry.displayName}',`);
      lines.push(`      description: '${entry.description.replace(/'/g, "\\'").replace(/\n/g, ' ')}',`);
      lines.push(`      type: '${entry.type}',`);
      if (entry.layer) lines.push(`      layer: '${entry.layer}',`);
      if (entry.httpMethod) lines.push(`      httpMethod: '${entry.httpMethod}',`);
      if (entry.path) lines.push(`      path: '${entry.path}',`);
      if (entry.roles) lines.push(`      roles: [${entry.roles.map((r) => `'${r}'`).join(', ')}],`);
      if (entry.stage) lines.push(`      stage: '${entry.stage}',`);
      if (entry.sequence != null) lines.push(`      sequence: ${entry.sequence},`);
      if (entry.eventName) lines.push(`      eventName: '${entry.eventName}',`);
      if (entry.metadata) lines.push(`      metadata: ${JSON.stringify(entry.metadata)},`);
      lines.push('    },');
    }
    lines.push('  ];');

    lines.push('}');

    const serviceContent = lines.join('\n') + '\n';

    // --- Type declaration ---
    const typeLines: string[] = [];

    typeLines.push('export interface AppBehaviorEntry {');
    typeLines.push('  name: string;');
    typeLines.push('  displayName: string;');
    typeLines.push('  description: string;');
    typeLines.push('  type: string;');
    typeLines.push("  layer?: 'Client' | 'Server';");
    typeLines.push('  httpMethod?: string;');
    typeLines.push('  path?: string;');
    typeLines.push('  roles?: readonly string[];');
    typeLines.push('  stage?: string;');
    typeLines.push('  sequence?: number;');
    typeLines.push('  eventName?: string;');
    typeLines.push('  metadata?: Record<string, unknown>;');
    typeLines.push('}');
    typeLines.push('');
    typeLines.push('export declare class AppBehaviorService {');
    typeLines.push('  readonly behaviors: readonly AppBehaviorEntry[];');
    typeLines.push('}');

    const typeContent = typeLines.join('\n') + '\n';

    debug('Generated app behavior service with %d behaviors', entries.length);

    const outputs = new Map<string, string>();
    outputs.set('client/src/app/services/app-behavior/app-behavior.service.ts', serviceContent);
    outputs.set('design/@types/services/app-behavior.d.ts', typeContent);

    return outputs;
  }
};

export { appBehaviorServiceGenerator };
