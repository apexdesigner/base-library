import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassByBase, getClassPropertyInitializer } from '@apexdesigner/utilities';
import { readFileSync } from 'fs';
import { join } from 'path';
import { kebabCase } from 'change-case';
import { Node } from 'ts-morph';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:packageService');

function getStringPropertyValue(sourceFile: DesignMetadata['sourceFile'], propertyName: string): string | undefined {
  const cls = getClassByBase(sourceFile, 'Project');
  if (!cls) return undefined;
  const initializer = getClassPropertyInitializer(cls, propertyName);
  if (initializer && Node.isStringLiteral(initializer)) {
    return initializer.getLiteralValue();
  }
  return undefined;
}

const packageServiceGenerator: DesignGenerator = {
  name: 'package-service',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'Project'
    }
  ],

  outputs: () => ['client/src/app/services/package/package.service.ts', 'design/@types/services/package.d.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const allProjects = context.listMetadata('Project');
    const mainProject = allProjects.find(p => !isLibrary(p));
    if (!mainProject) {
      throw new Error('Project not found');
    }

    // Read values from root package.json
    let pkgName = '';
    let version = '';
    let description = '';
    try {
      const rootPkg = JSON.parse(readFileSync(join(context.workspacePath, 'package.json'), 'utf-8'));
      pkgName = rootPkg.name || '';
      version = rootPkg.version || '';
      description = rootPkg.description || '';
    } catch {
      debug('could not read root package.json');
    }

    // Fall back to project metadata
    pkgName = pkgName || kebabCase(mainProject.name);
    version = version || '0.0.1';
    const displayName = getStringPropertyValue(mainProject.sourceFile, 'displayName') || '';

    debug('name %j, version %j, displayName %j', pkgName, version, displayName);

    // --- Runtime service ---
    const lines: string[] = [];

    lines.push("import { Injectable } from '@angular/core';");
    lines.push('');
    lines.push("@Injectable({ providedIn: 'root' })");
    lines.push('export class PackageService {');
    lines.push(`  readonly name = '${pkgName}';`);
    lines.push(`  readonly version = '${version}';`);
    lines.push(`  readonly description = '${description.replace(/'/g, "\\'")}';`);
    lines.push(`  readonly displayName = '${displayName.replace(/'/g, "\\'")}';`);
    lines.push('}');

    const serviceContent = lines.join('\n') + '\n';

    // --- Type declaration ---
    const typeLines: string[] = [];
    typeLines.push('export declare class PackageService {');
    typeLines.push('  readonly name: string;');
    typeLines.push('  readonly version: string;');
    typeLines.push('  readonly description: string;');
    typeLines.push('  readonly displayName: string;');
    typeLines.push('}');

    const typeContent = typeLines.join('\n') + '\n';

    debug('Generated package service');

    const outputs = new Map<string, string>();
    outputs.set('client/src/app/services/package/package.service.ts', serviceContent);
    outputs.set('design/@types/services/package.d.ts', typeContent);

    return outputs;
  }
};

export { packageServiceGenerator };
