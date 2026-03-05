import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassByBase, getDescription, getPropertyDecorator, getModuleLevelCall } from '@apexdesigner/utilities';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import { Node } from 'ts-morph';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:interfaceDefinitionSchema');

const interfaceDefinitionSchemaGenerator: DesignGenerator = {
  name: 'interface-definition-schema',

  triggers: [
    {
      metadataType: 'InterfaceDefinition',
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `server/src/schemas/interface-definitions/${kebabCase(metadata.name)}.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('metadata.name %j', metadata.name);

    const className = pascalCase(metadata.name);
    const schemaVarName = camelCase(metadata.name);
    debug('className %j', className);
    debug('schemaVarName %j', schemaVarName);

    const idClass = getClassByBase(metadata.sourceFile, 'InterfaceDefinition');
    if (!idClass) {
      debug('no InterfaceDefinition class found');
      return '';
    }

    const lines: string[] = [];

    // Add imports
    lines.push('import { z } from "zod";');
    lines.push('import "@apexdesigner/schema-tools";');

    // Build base type maps (same pattern as BO generator)
    const baseTypeValidValues = new Map<string, string[]>();
    const baseTypeNativeMap = new Map<string, string>();
    for (const bt of context.listMetadata('BaseType')) {
      // Valid values
      const valuesCall = getModuleLevelCall(bt.sourceFile, 'applyValidValues');
      if (valuesCall) {
        const args = valuesCall.getArguments();
        const arrayArg = args[1];
        if (arrayArg && Node.isArrayLiteralExpression(arrayArg)) {
          const values: string[] = [];
          for (const element of arrayArg.getElements()) {
            if (Node.isStringLiteral(element)) {
              values.push(element.getLiteralValue());
            } else if (Node.isObjectLiteralExpression(element)) {
              const valueProp = element.getProperty('value');
              if (valueProp && Node.isPropertyAssignment(valueProp)) {
                const init = valueProp.getInitializer();
                if (init && Node.isStringLiteral(init)) {
                  values.push(init.getLiteralValue());
                }
              }
            }
          }
          if (values.length > 0) {
            baseTypeValidValues.set(bt.name, values);
          }
        }
      }

      // Native type map
      const btClass = getClassByBase(bt.sourceFile, 'BaseType');
      if (!btClass) continue;
      const heritage = btClass.getExtends();
      if (!heritage) continue;
      const typeArgs = heritage.getTypeArguments();
      if (typeArgs.length > 0) {
        baseTypeNativeMap.set(pascalCase(bt.name), typeArgs[0].getText());
      }
    }

    debug('baseTypeValidValues %j', Object.fromEntries(baseTypeValidValues));
    debug('baseTypeNativeMap %j', Object.fromEntries(baseTypeNativeMap));

    // Build set of nested interface definition names for import detection
    const interfaceDefNames = new Set<string>();
    for (const idMeta of context.listMetadata('InterfaceDefinition')) {
      interfaceDefNames.add(pascalCase(idMeta.name));
    }

    // Track nested interface definition imports needed
    const nestedImports: { varName: string; fileName: string }[] = [];

    // Get properties from the class
    const properties = idClass.getProperties();
    debug('properties.length %j', properties.length);

    // Build schema object properties
    const schemaProps: string[] = [];

    for (const prop of properties) {
      const propName = prop.getName();
      const isOptional = prop.hasQuestionToken();
      const isRequired = prop.hasExclamationToken();
      let zodType = 'z.unknown()';

      const typeNode = prop.getTypeNode();
      if (typeNode) {
        const typeText = typeNode.getText();

        if (typeText === 'string') {
          zodType = 'z.string()';
        } else if (typeText === 'number') {
          zodType = 'z.number()';
        } else if (typeText === 'boolean') {
          zodType = 'z.boolean()';
        } else if (typeText === 'Date') {
          zodType = 'z.date()';
        } else if (typeText === 'string[]') {
          zodType = 'z.array(z.string())';
        } else if (typeText === 'number[]') {
          zodType = 'z.array(z.number())';
        } else if (typeText === 'boolean[]') {
          zodType = 'z.array(z.boolean())';
        } else if (baseTypeValidValues.has(typeText)) {
          const values = baseTypeValidValues.get(typeText)!;
          zodType = `z.enum([${values.map(v => `"${v.replace(/"/g, '\\"')}"`).join(', ')}])`;
        } else if (baseTypeNativeMap.has(typeText)) {
          const native = baseTypeNativeMap.get(typeText)!;
          if (native === 'string') zodType = 'z.string()';
          else if (native === 'number') zodType = 'z.number()';
          else if (native === 'boolean') zodType = 'z.boolean()';
        } else if (interfaceDefNames.has(typeText) && typeText !== className) {
          // Nested interface definition reference
          const nestedVar = camelCase(typeText);
          const nestedFile = kebabCase(typeText);
          zodType = nestedVar;
          if (!nestedImports.find(i => i.varName === nestedVar)) {
            nestedImports.push({ varName: nestedVar, fileName: nestedFile });
          }
        } else if (typeText.endsWith('[]') && interfaceDefNames.has(typeText.slice(0, -2))) {
          // Array of nested interface definitions
          const innerType = typeText.slice(0, -2);
          const nestedVar = camelCase(innerType);
          const nestedFile = kebabCase(innerType);
          zodType = `z.array(${nestedVar})`;
          if (!nestedImports.find(i => i.varName === nestedVar)) {
            nestedImports.push({ varName: nestedVar, fileName: nestedFile });
          }
        } else {
          zodType = 'z.unknown()';
        }
      }

      // Get @property() decorator options
      const opts = getPropertyDecorator(prop, 'property') || {};
      debug('property %j opts %j', propName, opts);

      // Get JSDoc if available
      const jsDocs = prop.getJsDocs();
      let description = '';
      if (jsDocs.length > 0) {
        const comment = jsDocs[0].getComment();
        if (typeof comment === 'string') {
          description = comment.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }

      // Build the schema chain
      const chain: string[] = [zodType];

      if (isOptional) { chain.push('.nullable()'); chain.push('.optional()'); }
      if (opts.hidden) chain.push('.hidden()');
      if (opts.required) chain.push('.requiredFinal()');
      if (opts.disabled) chain.push('.disabled()');
      for (const key of ['displayName', 'placeholder', 'helpText', 'presentAs'] as const) {
        const val = opts[key];
        if (val) chain.push(`.${key}("${String(val).replace(/"/g, '\\"')}")`);
      }

      // Conditional rules
      for (const rule of ['requiredWhen', 'excludeWhen', 'disabledWhen'] as const) {
        const val = opts[rule];
        if (!val) continue;

        if (typeof val === 'string') {
          chain.push(`.${rule}("${val.replace(/"/g, '\\"')}")`);
        } else if (typeof val === 'object' && val !== null) {
          const obj = val as Record<string, unknown>;
          const condition = obj.condition as string | undefined;
          const message = obj.message as string | undefined;
          if (condition && message) {
            chain.push(`.${rule}("${condition.replace(/"/g, '\\"')}", "${message.replace(/"/g, '\\"')}")`);
          } else if (condition) {
            chain.push(`.${rule}("${condition.replace(/"/g, '\\"')}")`);
          }
        }
      }

      if (description) {
        chain.push(`.describe("${description.replace(/"/g, '\\"')}")`);
      } else {
        chain.push(`.describe("${propName}")`);
      }

      schemaProps.push(`    ${propName}: ${chain.join('\n      ')}`);
    }

    // Add nested interface definition imports
    for (const imp of nestedImports) {
      lines.push(`import { ${imp.varName} } from "./${imp.fileName}.js";`);
    }

    lines.push('');

    // Create the schema declaration
    const classDescription = getDescription(idClass);
    const entityDescription = (classDescription || className).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    lines.push(`export const ${schemaVarName} = z`);
    lines.push('  .object({');
    lines.push(schemaProps.join(',\n\n'));
    lines.push('  })');
    lines.push(`  .describe("${entityDescription.replace(/"/g, '\\"')}")`);
    lines.push(`  .as("${className}");`);
    lines.push('');
    lines.push(`export { ${schemaVarName} as ${schemaVarName}Schema };`);

    const content = lines.join('\n');
    debug('content.length %j', content.length);

    return content;
  }
};

export { interfaceDefinitionSchemaGenerator };
