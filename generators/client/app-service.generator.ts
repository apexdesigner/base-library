import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getBehaviorFunction, getBehaviorOptions, getModuleLevelCall } from '@apexdesigner/utilities';
import { classifyBehaviorParams } from '../shared/classify-params.js';
import { Node } from 'ts-morph';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:appService');

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

const appServiceGenerator: DesignGenerator = {
  name: 'app-service',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'AppBehavior'
    },
    {
      metadataType: 'Project'
    }
  ],

  outputs: () => ['client/src/app/services/app/app.service.ts', 'design/@types/services/app.d.ts'],

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

    // Build typed HTTP method wrappers for Class Behaviors
    const NON_HTTP_TYPES = new Set(['Lifecycle Behavior', 'Middleware', 'Guard', 'Event']);
    interface HttpMethodEntry {
      name: string;
      paramStr: string;
      returnType: string;
      httpMethod: string;
      urlExpr: string;
      bodyArg: string;
      hasHeaders: boolean;
      headersArg?: string;
    }
    const httpMethods: HttpMethodEntry[] = [];

    for (const ab of appBehaviors) {
      const options = getBehaviorOptions(ab.sourceFile);
      if (!options) continue;
      if (NON_HTTP_TYPES.has(options.type as string)) continue;
      if (!options.path) continue;

      const func = getBehaviorFunction(ab.sourceFile);
      if (!func) continue;

      const params = func.parameters || [];
      const routePath = options.path as string;
      const classified = classifyBehaviorParams(params, routePath);

      const paramStr = params
        .map(p => {
          const cp = classified.all.find(c => c.name === p.name);
          const optional = p.isOptional ? '?' : '';
          const type = cp?.source === 'header' ? cp.innerType || 'string' : p.type || 'any';
          return `${p.name}${optional}: ${type}`;
        })
        .join(', ');

      // Build URL expression with path param interpolation
      let urlPath = routePath;
      for (const pp of classified.path) {
        urlPath = urlPath.replace(`:${pp.name}`, `\${${pp.name}}`);
      }
      const urlExpr = classified.path.length > 0 ? `\`${urlPath}\`` : `'${urlPath}'`;

      // Build body arg
      const OBJECT_TYPES = new Set(['any', 'object', 'Record']);
      const bodyIsPassthrough =
        classified.body.length === 1 && (OBJECT_TYPES.has(classified.body[0].type || 'any') || (classified.body[0].type || '').startsWith('{'));
      const bodyArg =
        classified.body.length === 0 ? '{}' : bodyIsPassthrough ? classified.body[0].name : `{ ${classified.body.map(p => p.name).join(', ')} }`;

      // Build headers arg
      const hasHeaders = classified.header.length > 0;
      const headersArg = hasHeaders ? `{ headers: { ${classified.header.map(p => `'${p.name}': String(${p.name})`).join(', ')} } }` : undefined;

      const httpMethod = ((options.httpMethod as string) || 'Post').toLowerCase();
      const returnType = func.returnType || 'any';

      httpMethods.push({ name: func.name, paramStr, returnType, httpMethod, urlExpr, bodyArg, hasHeaders, headersArg });
    }

    const hasHttpMethods = httpMethods.length > 0;

    // --- Runtime service ---
    const lines: string[] = [];

    lines.push("import { Injectable, inject } from '@angular/core';");
    if (hasHttpMethods) {
      lines.push("import { HttpClient } from '@angular/common/http';");
      lines.push("import { firstValueFrom } from 'rxjs';");
    }
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
    lines.push('export class AppService {');

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
      if (entry.roles) lines.push(`      roles: [${entry.roles.map(r => `'${r}'`).join(', ')}],`);
      if (entry.stage) lines.push(`      stage: '${entry.stage}',`);
      if (entry.sequence != null) lines.push(`      sequence: ${entry.sequence},`);
      if (entry.eventName) lines.push(`      eventName: '${entry.eventName}',`);
      if (entry.metadata) lines.push(`      metadata: ${JSON.stringify(entry.metadata)},`);
      lines.push('    },');
    }
    lines.push('  ];');

    // HTTP call wrapper methods
    if (hasHttpMethods) {
      lines.push('');
      lines.push('  private http = inject(HttpClient);');

      for (const m of httpMethods) {
        lines.push('');
        lines.push(`  async ${m.name}(${m.paramStr}): Promise<${m.returnType}> {`);
        lines.push(`    const url = ${m.urlExpr};`);

        const opts = m.headersArg || '';
        switch (m.httpMethod) {
          case 'get':
            lines.push(`    return firstValueFrom(this.http.get<${m.returnType}>(url${opts ? `, ${opts}` : ''}));`);
            break;
          case 'delete':
            lines.push(`    return firstValueFrom(this.http.delete<${m.returnType}>(url${opts ? `, ${opts}` : ''}));`);
            break;
          case 'put':
            lines.push(`    return firstValueFrom(this.http.put<${m.returnType}>(url, ${m.bodyArg}${opts ? `, ${opts}` : ''}));`);
            break;
          case 'patch':
            lines.push(`    return firstValueFrom(this.http.patch<${m.returnType}>(url, ${m.bodyArg}${opts ? `, ${opts}` : ''}));`);
            break;
          default:
            lines.push(`    return firstValueFrom(this.http.post<${m.returnType}>(url, ${m.bodyArg}${opts ? `, ${opts}` : ''}));`);
            break;
        }

        lines.push('  }');
      }
    }

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
    typeLines.push('export declare class AppService {');
    typeLines.push('  readonly behaviors: readonly AppBehaviorEntry[];');
    for (const m of httpMethods) {
      typeLines.push(`  ${m.name}(${m.paramStr}): Promise<${m.returnType}>;`);
    }
    typeLines.push('}');

    const typeContent = typeLines.join('\n') + '\n';

    debug('Generated app service with %d behaviors', entries.length);

    const outputs = new Map<string, string>();
    outputs.set('client/src/app/services/app/app.service.ts', serviceContent);
    outputs.set('design/@types/services/app.d.ts', typeContent);

    return outputs;
  }
};

export { appServiceGenerator };
