import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { getClassByBase, getDescription } from '@apexdesigner/utilities';
import { pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:serverInterfaceDefinitions');

/**
 * Map a property type from the design file to a plain TypeScript type.
 */
function mapPropertyType(
  typeText: string,
  baseTypeNativeMap: Map<string, string>,
  interfaceDefNames: Set<string>,
): string {
  if (['string', 'number', 'boolean', 'any'].includes(typeText)) return typeText;
  if (typeText === 'Date') return 'Date';

  if (typeText === 'string[]') return 'string[]';
  if (typeText === 'number[]') return 'number[]';
  if (typeText === 'boolean[]') return 'boolean[]';

  if (baseTypeNativeMap.has(typeText)) return baseTypeNativeMap.get(typeText)!;

  if (typeText.endsWith('[]')) {
    const inner = typeText.slice(0, -2);
    if (baseTypeNativeMap.has(inner)) return `${baseTypeNativeMap.get(inner)!}[]`;
  }

  if (interfaceDefNames.has(typeText)) return typeText;
  if (typeText.endsWith('[]') && interfaceDefNames.has(typeText.slice(0, -2))) return typeText;

  return 'any';
}

const serverInterfaceDefinitionsGenerator: DesignGenerator = {
  name: 'server-interface-definitions',

  isAggregate: true,

  triggers: [
    {
      metadataType: 'InterfaceDefinition',
    },
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => ['server/src/interface-definitions/index.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');

    const interfaceDefs = context.listMetadata('InterfaceDefinition');
    debug('interfaceDefs.length %j', interfaceDefs.length);

    if (interfaceDefs.length === 0) return '';

    // Build base type native map
    const baseTypeNativeMap = new Map<string, string>();
    for (const bt of context.listMetadata('BaseType')) {
      const btClass = getClassByBase(bt.sourceFile, 'BaseType');
      if (!btClass) continue;
      const heritage = btClass.getExtends();
      if (!heritage) continue;
      const typeArgs = heritage.getTypeArguments();
      if (typeArgs.length > 0) {
        baseTypeNativeMap.set(pascalCase(bt.name), typeArgs[0].getText());
      }
    }
    debug('baseTypeNativeMap %j', Object.fromEntries(baseTypeNativeMap));

    // Build set of interface definition names
    const interfaceDefNames = new Set<string>();
    for (const id of interfaceDefs) {
      interfaceDefNames.add(pascalCase(id.name));
    }

    const lines: string[] = [];

    const sorted = [...interfaceDefs].sort((a, b) =>
      pascalCase(a.name).localeCompare(pascalCase(b.name))
    );

    for (const id of sorted) {
      const className = pascalCase(id.name);
      const idClass = getClassByBase(id.sourceFile, 'InterfaceDefinition');
      if (!idClass) {
        debug('no InterfaceDefinition class found for %j', id.name);
        continue;
      }

      const description = getDescription(idClass);
      if (description) {
        lines.push('/**');
        for (const line of description.split('\n')) {
          lines.push(` * ${line}`);
        }
        lines.push(' */');
      }

      lines.push(`export interface ${className} {`);

      for (const prop of idClass.getProperties()) {
        const propName = prop.getName();
        const isOptional = prop.hasQuestionToken();
        const isRequired = prop.hasExclamationToken();
        const typeNode = prop.getTypeNode();
        const typeText = typeNode ? typeNode.getText() : 'any';

        const mappedType = mapPropertyType(typeText, baseTypeNativeMap, interfaceDefNames);

        const jsDocs = prop.getJsDocs();
        if (jsDocs.length > 0) {
          const comment = jsDocs[0].getComment();
          if (typeof comment === 'string') {
            lines.push(`  /** ${comment.replace(/\n/g, ' ').trim()} */`);
          }
        }

        if (isRequired) {
          lines.push(`  ${propName}: ${mappedType};`);
        } else if (isOptional) {
          lines.push(`  ${propName}?: ${mappedType};`);
        } else {
          lines.push(`  ${propName}: ${mappedType};`);
        }
      }

      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  },
};

export { serverInterfaceDefinitionsGenerator };
