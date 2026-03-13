import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassByBase, getDisplayName, getDescription } from '@apexdesigner/utilities';
import { Node } from 'ts-morph';
import { kebabCase, pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:componentService');

/** Strip 'Component' suffix to get the base name */
function getBaseName(name: string): string {
  return name.replace(/Component$/, '');
}

interface ComponentEntry {
  name: string;
  className: string;
  importPath: string;
  selector: string;
  displayName: string;
  description: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  isDialog: boolean;
  isCustomElement: boolean;
  allowChildren: boolean;
  metadata?: Record<string, unknown>;
}

/** Extract boolean flags and metadata from @component() decorator options */
function getDecoratorOptions(metadata: DesignMetadata): {
  isDialog: boolean;
  isCustomElement: boolean;
  allowChildren: boolean;
  metadata: Record<string, unknown>;
} {
  const cls = getClassByBase(metadata.sourceFile, 'Component');
  let isDialog = false;
  let isCustomElement = false;
  let allowChildren = false;
  let componentMetadata: Record<string, unknown> = {};

  if (cls) {
    const decorator = cls.getDecorator('component');
    if (decorator) {
      const args = decorator.getArguments();
      if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
        const text = args[0].getText();
        if (/isDialog:\s*true/.test(text)) isDialog = true;
        if (/isCustomElement:\s*true/.test(text)) isCustomElement = true;
        if (/allowChildren:\s*true/.test(text)) allowChildren = true;

        const metadataProp = args[0].getProperty('metadata');
        if (metadataProp && Node.isPropertyAssignment(metadataProp)) {
          const init = metadataProp.getInitializerOrThrow();
          if (Node.isObjectLiteralExpression(init)) {
            for (const prop of init.getProperties()) {
              if (Node.isPropertyAssignment(prop)) {
                const key = prop.getName();
                const valueText = prop.getInitializerOrThrow().getText();
                // Parse simple literal values
                if (valueText === 'true') componentMetadata[key] = true;
                else if (valueText === 'false') componentMetadata[key] = false;
                else if (/^-?\d+(\.\d+)?$/.test(valueText)) componentMetadata[key] = Number(valueText);
                else if (/^['"]/.test(valueText)) componentMetadata[key] = valueText.slice(1, -1);
                else componentMetadata[key] = valueText;
              }
            }
          }
        }
      }
    }
  }

  return { isDialog, isCustomElement, allowChildren, metadata: componentMetadata };
}

/** Extract input and output properties from a component class */
function getInputsAndOutputs(metadata: DesignMetadata): { inputs: { name: string; type: string }[]; outputs: { name: string; type: string }[] } {
  const cls = getClassByBase(metadata.sourceFile, 'Component');
  const inputs: { name: string; type: string }[] = [];
  const outputs: { name: string; type: string }[] = [];

  if (!cls) return { inputs, outputs };

  for (const prop of cls.getProperties()) {
    const decorator = prop.getDecorator('property');
    if (!decorator) continue;

    const args = decorator.getArguments();
    if (args.length === 0 || !Node.isObjectLiteralExpression(args[0])) continue;

    const isInputProp = args[0].getProperty('isInput');
    const isOutputProp = args[0].getProperty('isOutput');

    const isInput = isInputProp && Node.isPropertyAssignment(isInputProp) && isInputProp.getInitializerOrThrow().getText() === 'true';
    const isOutput = isOutputProp && Node.isPropertyAssignment(isOutputProp) && isOutputProp.getInitializerOrThrow().getText() === 'true';

    const typeText = prop.getTypeNode()?.getText() || 'any';
    const name = prop.getName();

    if (isInput) {
      inputs.push({ name, type: typeText });
    }
    if (isOutput) {
      outputs.push({ name, type: typeText });
    }
  }

  return { inputs, outputs };
}

const componentServiceGenerator: DesignGenerator = {
  name: 'component-service',
  isAggregate: true,

  triggers: [
    {
      metadataType: 'Component'
    },
    {
      metadataType: 'Project'
    }
  ],

  outputs: () => ['client/src/app/services/component/component.service.ts', 'design/@types/services/component.d.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    // Get project name for debug namespace
    const projectMeta = context.listMetadata('Project').find(p => !isLibrary(p));
    const debugNamespace = pascalCase((projectMeta?.name || 'App').replace(/Project$/, ''));

    // Collect all components, sorted by name, excluding AppComponent
    const components = context
      .listMetadata('Component')
      .filter(c => getBaseName(c.name) !== 'App')
      .sort((a, b) => a.name.localeCompare(b.name));

    debug('found %d components', components.length);

    const entries: ComponentEntry[] = components.map(c => {
      const baseName = getBaseName(c.name);
      const kebab = kebabCase(baseName);
      const cls = getClassByBase(c.sourceFile, 'Component');
      const flags = getDecoratorOptions(c);
      const { inputs, outputs } = getInputsAndOutputs(c);

      return {
        name: baseName,
        className: `${baseName}Component`,
        importPath: `../../components/${kebab}/${kebab}.component`,
        selector: kebab,
        displayName: (cls && getDisplayName(cls)) || baseName,
        description: (cls && getDescription(cls)) || '',
        inputs,
        outputs,
        ...flags
      };
    });

    // --- Runtime service ---
    const lines: string[] = [];

    lines.push("import { Injectable } from '@angular/core';");
    lines.push("import type { Type } from '@angular/core';");
    lines.push('import createDebug from "debug";');
    lines.push('');
    lines.push(`const debug = createDebug("${debugNamespace}:ComponentService");`);
    lines.push('');

    // ComponentMetadata interface
    lines.push('export interface ComponentMetadata {');
    lines.push('  name: string;');
    lines.push('  selector: string;');
    lines.push('  displayName: string;');
    lines.push('  description: string;');
    lines.push('  inputs: readonly { name: string; type: string }[];');
    lines.push('  outputs: readonly { name: string; type: string }[];');
    lines.push('  isDialog: boolean;');
    lines.push('  isCustomElement: boolean;');
    lines.push('  allowChildren: boolean;');
    lines.push('  metadata?: Record<string, unknown>;');
    lines.push('}');
    lines.push('');

    lines.push("@Injectable({ providedIn: 'root' })");
    lines.push('export class ComponentService {');

    // names array
    const namesList = entries.map(e => `'${e.name}'`).join(', ');
    lines.push(`  readonly names = [${namesList}] as const;`);
    lines.push('');

    // metadata array
    lines.push('  readonly metadata: readonly ComponentMetadata[] = [');
    for (const entry of entries) {
      const inputsStr = entry.inputs.length === 0 ? '[]' : `[${entry.inputs.map(i => `{ name: '${i.name}', type: '${i.type}' }`).join(', ')}]`;
      const outputsStr = entry.outputs.length === 0 ? '[]' : `[${entry.outputs.map(o => `{ name: '${o.name}', type: '${o.type}' }`).join(', ')}]`;
      lines.push('    {');
      lines.push(`      name: '${entry.name}',`);
      lines.push(`      selector: '${entry.selector}',`);
      lines.push(`      displayName: '${entry.displayName}',`);
      lines.push(`      description: '${entry.description.replace(/'/g, "\\'").replace(/\n/g, ' ')}',`);
      lines.push(`      inputs: ${inputsStr},`);
      lines.push(`      outputs: ${outputsStr},`);
      lines.push(`      isDialog: ${entry.isDialog},`);
      lines.push(`      isCustomElement: ${entry.isCustomElement},`);
      lines.push(`      allowChildren: ${entry.allowChildren},`);
      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        lines.push(`      metadata: ${JSON.stringify(entry.metadata)},`);
      }
      lines.push('    },');
    }
    lines.push('  ];');
    lines.push('');

    // getMetadata method
    lines.push('  getMetadata(name: string): ComponentMetadata | undefined {');
    lines.push('    return this.metadata.find(m => m.name === name);');
    lines.push('  }');
    lines.push('');

    // loadComponent method
    lines.push('  async loadComponent(name: string): Promise<Type<any>> {');
    lines.push('    debug("loadComponent %s", name);');
    lines.push('    switch (name) {');
    for (const entry of entries) {
      lines.push(`      case '${entry.name}':`);
      lines.push(`        return import('${entry.importPath}').then(m => m.${entry.className});`);
    }
    lines.push('      default:');
    lines.push('        throw new Error(`Unknown component: ${name}`);');
    lines.push('    }');
    lines.push('  }');

    lines.push('}');

    const serviceContent = lines.join('\n') + '\n';

    // --- Type declaration ---
    const typeLines: string[] = [];
    typeLines.push("import type { Type } from '@angular/core';");
    typeLines.push('');
    typeLines.push('export interface ComponentMetadata {');
    typeLines.push('  name: string;');
    typeLines.push('  selector: string;');
    typeLines.push('  displayName: string;');
    typeLines.push('  description: string;');
    typeLines.push('  inputs: readonly { name: string; type: string }[];');
    typeLines.push('  outputs: readonly { name: string; type: string }[];');
    typeLines.push('  isDialog: boolean;');
    typeLines.push('  isCustomElement: boolean;');
    typeLines.push('  allowChildren: boolean;');
    typeLines.push('  metadata?: Record<string, unknown>;');
    typeLines.push('}');
    typeLines.push('');
    typeLines.push('export declare class ComponentService {');
    typeLines.push('  readonly names: readonly string[];');
    typeLines.push('  readonly metadata: readonly ComponentMetadata[];');
    typeLines.push('  getMetadata(name: string): ComponentMetadata | undefined;');
    typeLines.push('  loadComponent(name: string): Promise<Type<any>>;');
    typeLines.push('}');

    const typeContent = typeLines.join('\n') + '\n';

    debug('Generated component service with %d components', entries.length);

    const outputs = new Map<string, string>();
    outputs.set('client/src/app/services/component/component.service.ts', serviceContent);
    outputs.set('design/@types/services/component.d.ts', typeContent);

    return outputs;
  }
};

export { componentServiceGenerator };
