import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getDataSource, getIdProperty, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase, getDescription, getPropertyDecorator, getObjectLiteralValue, getModuleLevelCall, getTemplateString } from '@apexdesigner/utilities';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import { Node } from 'ts-morph';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:businessObjectSchema');

function toObjectLiteral(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj).map(([k, v]) => {
    let val: string;
    if (typeof v === 'string') {
      val = `"${v.replace(/"/g, '\\"')}"`;
    } else if (typeof v === 'object' && v !== null) {
      val = toObjectLiteral(v as Record<string, unknown>);
    } else {
      val = String(v);
    }
    return `${k}: ${val}`;
  });
  return `{ ${entries.join(', ')} }`;
}

const businessObjectSchemaGenerator: DesignGenerator = {
  name: 'business-object-schema',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata, conditionContext) => {
        if (!conditionContext?.context) return true;
        return !!getDataSource(metadata.sourceFile, conditionContext.context);
      },
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `server/src/schemas/business-objects/${kebabCase(metadata.name)}.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);
    debug('sourceFile path %j', metadata.sourceFile.getFilePath());

    const className = pascalCase(metadata.name);
    const schemaVarName = camelCase(metadata.name);
    debug('className %j, schemaVarName %j', className, schemaVarName);

    const lines: string[] = [];

    // Add imports
    lines.push('import { z } from "zod";');
    lines.push('import "@apexdesigner/schema-tools";');
    lines.push('import "@apexdesigner/schema-persistence/extensions";');

    // Get relationships to determine what to import
    const relationships = resolveRelationships(metadata.sourceFile, context);
    debug('relationships count %j', relationships.length);

    // Determine which relationship functions and helpers we need
    const imports = new Set<string>();

    relationships.forEach(rel => {
      if (rel.relationshipType === 'Belongs To') {
        imports.add('belongsTo');
      } else if (rel.relationshipType === 'Has Many') {
        imports.add('hasMany');
      } else if (rel.relationshipType === 'Has One') {
        imports.add('hasOne');
      } else if (rel.relationshipType === 'References') {
        imports.add('references');
      }
    });

    // schema-tools import is deferred until after property processing (see below)


    // Get id property info
    const idProperty = getIdProperty(metadata.sourceFile, context);
    debug('idProperty %j', idProperty);

    // Get the BO class early — needed for id decorator check and property listing
    const boClass = getClassByBase(metadata.sourceFile, 'BusinessObject');

    // Determine if using Postgres (used for id and foreign key column type inference)
    let isPostgres = false;
    const ds = getDataSource(metadata.sourceFile, context);
    if (ds) {
      const dsClass = getClassByBase(ds.sourceFile, 'DataSource');
      if (dsClass) {
        const config = getObjectLiteralValue(dsClass, 'configuration');
        if ((config?.persistenceType as string | undefined)?.toLowerCase() === 'postgres') {
          isPostgres = true;
        }
      }
    }
    debug('isPostgres %j', isPostgres);

    // Build base type property defaults and valid values maps (needed for id, FK, and property handling)
    const baseTypeColumnDefaults = new Map<string, string>();
    const baseTypePropertyDefaults = new Map<string, Record<string, string | boolean>>();
    const baseTypeValidValues = new Map<string, string[]>();
    for (const bt of context.listMetadata('BaseType')) {
      const propDefaultsCall = getModuleLevelCall(bt.sourceFile, 'setPropertyDefaults');
      if (propDefaultsCall) {
        const args = propDefaultsCall.getArguments();
        const optsArg = args[1];
        if (optsArg && Node.isObjectLiteralExpression(optsArg)) {
          const defaults: Record<string, string | boolean> = {};
          const columnProp = optsArg.getProperty('column');
          if (columnProp && Node.isPropertyAssignment(columnProp)) {
            const init = columnProp.getInitializer();
            if (init && Node.isStringLiteral(init)) {
              baseTypeColumnDefaults.set(bt.name, init.getLiteralValue());
            }
          }
          for (const key of ['presentAs', 'displayName', 'placeholder', 'helpText'] as const) {
            const prop = optsArg.getProperty(key);
            if (prop && Node.isPropertyAssignment(prop)) {
              const init = prop.getInitializer();
              if (init && Node.isStringLiteral(init)) {
                defaults[key] = init.getLiteralValue();
              }
            }
          }
          for (const key of ['hidden', 'disabled'] as const) {
            const prop = optsArg.getProperty(key);
            if (prop && Node.isPropertyAssignment(prop)) {
              const init = prop.getInitializer();
              if (init && init.getText() === 'true') {
                defaults[key] = true;
              }
            }
          }
          if (Object.keys(defaults).length > 0) {
            baseTypePropertyDefaults.set(bt.name, defaults);
          }
        }
      }

      const valuesCall = getModuleLevelCall(bt.sourceFile, 'applyValidValues');
      if (valuesCall) {
        const args = valuesCall.getArguments();
        const arrayArg = args[1];
        if (arrayArg && Node.isArrayLiteralExpression(arrayArg)) {
          const values: string[] = [];
          for (const element of arrayArg.getElements()) {
            if (Node.isStringLiteral(element)) {
              // Simple string value: "Deployed"
              values.push(element.getLiteralValue());
            } else if (Node.isObjectLiteralExpression(element)) {
              // Object value: { name: "Active", value: "active" }
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
    }
    // Build base type name → native type map (e.g. Email → string, Uuid → string)
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

    debug('baseTypeColumnDefaults %j', Object.fromEntries(baseTypeColumnDefaults));
    debug('baseTypeValidValues %j', Object.fromEntries(baseTypeValidValues));
    debug('baseTypeNativeMap %j', Object.fromEntries(baseTypeNativeMap));

    // Determine id Zod type and column config
    let idZodType = 'z.number()';
    let idColumnConfig = '';
    if (idProperty.type === 'string' || idProperty.type === 'String') {
      idZodType = 'z.string()';
    } else if (idProperty.type === 'Serial') {
      idColumnConfig = '.column({ autoIncrement: true, type: "INTEGER" })';
    } else if (baseTypeColumnDefaults.has(idProperty.type)) {
      // Base type id (e.g. Uuid) — use appropriate zod type and column defaults
      idZodType = idProperty.type === 'Uuid' ? 'z.uuid()' : 'z.string()';
      const columnType = baseTypeColumnDefaults.get(idProperty.type)!;
      idColumnConfig = `.column({ type: "${columnType.replace(/"/g, '\\"')}" })`;
    } else {
      // Check @property() decorator for explicit column config first
      const idPropNode = boClass?.getProperty(idProperty.name);
      let explicitColumn: Record<string, unknown> | undefined;
      if (idPropNode) {
        const idOpts = getPropertyDecorator(idPropNode, 'property') || {};
        explicitColumn = idOpts.column as Record<string, unknown> | undefined;
      }

      if (explicitColumn) {
        idColumnConfig = `.column(${toObjectLiteral(explicitColumn)})`;
      } else if (isPostgres) {
        idColumnConfig = '.column({ autoIncrement: true, type: "INTEGER" })';
      }
    }

    // Get properties from the class
    const properties = boClass?.getProperties() || [];
    debug('properties count %j', properties.length);

    // Create a set of names to skip
    const skipNames = new Set<string>();
    skipNames.add(idProperty.name);
    relationships.forEach(rel => {
      skipNames.add(rel.relationshipName);
      if (rel.foreignKey) {
        skipNames.add(rel.foreignKey);
      }
    });

    // Build schema object properties
    const schemaProps: string[] = [];

    // Add id property (hidden from forms)
    schemaProps.push(`    ${idProperty.name}: ${idZodType}${idColumnConfig}\n      .hidden()\n      .describe("Unique identifier")`);

    // Add scalar properties
    for (const prop of properties) {
      const propName = prop.getName();
      if (skipNames.has(propName)) continue;

      const isOptional = prop.hasQuestionToken();
      let zodType = 'z.unknown()';

      // Get the type and map to Zod
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
        } else if (typeText === 'DateTime') {
          zodType = 'datetime()';
          imports.add('datetime');
        } else if (baseTypeValidValues.has(typeText)) {
          const values = baseTypeValidValues.get(typeText)!;
          zodType = `z.enum([${values.map(v => `"${v.replace(/"/g, '\\"')}"`).join(', ')}])`;
        } else if (baseTypeNativeMap.has(typeText)) {
          const native = baseTypeNativeMap.get(typeText)!;
          if (native === 'string') zodType = 'z.string()';
          else if (native === 'number') zodType = 'z.number()';
          else if (native === 'boolean') zodType = 'z.boolean()';
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
          description = comment.trim();
        }
      }

      // Build the schema chain
      const chain: string[] = [zodType];

      if (isOptional) { chain.push('.nullable()'); chain.push('.optional()'); }
      if (opts.column && typeof opts.column === 'object') {
        chain.push(`.column(${toObjectLiteral(opts.column as Record<string, unknown>)})`);
      } else if (typeNode) {
        const typeText = typeNode.getText();
        const baseTypeDefault = baseTypeColumnDefaults.get(typeText);
        if (baseTypeDefault) {
          chain.push(`.column({ type: "${baseTypeDefault.replace(/"/g, '\\"')}" })`);
        }
      }
      // Resolve base type property defaults as fallbacks
      const btDefaults = typeNode ? baseTypePropertyDefaults.get(typeNode.getText()) : undefined;
      if (opts.hidden || btDefaults?.hidden) chain.push('.hidden()');
      if (opts.required) chain.push('.requiredFinal()');
      if (opts.disabled || btDefaults?.disabled) chain.push('.disabled()');
      for (const key of ['displayName', 'placeholder', 'helpText', 'presentAs'] as const) {
        const val = opts[key] || btDefaults?.[key];
        if (val) chain.push(`.${key}("${String(val).replace(/"/g, '\\"')}")`);
      }

      // Conditional rules — direct arrow fn or { condition, message } object
      for (const rule of ['requiredWhen', 'excludeWhen', 'disabledWhen'] as const) {
        const val = opts[rule];
        if (!val) continue;

        if (typeof val === 'string') {
          // Direct arrow function source text
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

    // Add mixin properties
    const mixins = resolveMixins(metadata.sourceFile, context);
    debug('mixins count %j', mixins.length);
    for (const mixin of mixins) {
      const mixinClass = getClassByBase(mixin.metadata.sourceFile, 'Mixin');
      if (!mixinClass) continue;
      for (const prop of mixinClass.getProperties()) {
        const propName = prop.getName();
        if (skipNames.has(propName)) continue;

        const isOptional = prop.hasQuestionToken();
        let zodType = 'z.unknown()';

        const typeNode = prop.getTypeNode();
        if (typeNode) {
          const typeText = typeNode.getText();
          if (typeText === 'string') zodType = 'z.string()';
          else if (typeText === 'number') zodType = 'z.number()';
          else if (typeText === 'boolean') zodType = 'z.boolean()';
          else if (typeText === 'Date') zodType = 'z.coerce.date()';
          else if (typeText === 'DateTime') { zodType = 'datetime()'; imports.add('datetime'); }
          else if (baseTypeValidValues.has(typeText)) {
            const values = baseTypeValidValues.get(typeText)!;
            zodType = `z.enum([${values.map(v => `"${v.replace(/"/g, '\\"')}"`).join(', ')}])`;
          } else if (baseTypeNativeMap.has(typeText)) {
            const native = baseTypeNativeMap.get(typeText)!;
            if (native === 'string') zodType = 'z.string()';
            else if (native === 'number') zodType = 'z.number()';
            else if (native === 'boolean') zodType = 'z.boolean()';
          }
        }

        // Get @property() decorator options
        const opts = getPropertyDecorator(prop, 'property') || {};
        debug('mixin property %j opts %j', propName, opts);

        const chain: string[] = [zodType];

        if (isOptional) { chain.push('.nullable()'); chain.push('.optional()'); }
        if (opts.column && typeof opts.column === 'object') {
          chain.push(`.column(${toObjectLiteral(opts.column as Record<string, unknown>)})`);
        } else if (typeNode) {
          const typeText = typeNode.getText();
          const baseTypeDefault = baseTypeColumnDefaults.get(typeText);
          if (baseTypeDefault) {
            chain.push(`.column({ type: "${baseTypeDefault.replace(/"/g, '\\"')}" })`);
          }
        }
        // Resolve base type property defaults as fallbacks
        const mixinBtDefaults = typeNode ? baseTypePropertyDefaults.get(typeNode.getText()) : undefined;
        if (opts.hidden || mixinBtDefaults?.hidden) chain.push('.hidden()');
        if (opts.required) chain.push('.requiredFinal()');
        if (opts.disabled || mixinBtDefaults?.disabled) chain.push('.disabled()');
        for (const key of ['displayName', 'placeholder', 'helpText', 'presentAs'] as const) {
          const val = opts[key] || mixinBtDefaults?.[key];
          if (val) chain.push(`.${key}("${String(val).replace(/"/g, '\\"')}")`);
        }

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

        chain.push(`.describe("${propName}")`);

        schemaProps.push(`    ${propName}: ${chain.join('\n      ')}`);
      }
    }

    // Add foreign keys for belongsTo and references relationships
    for (const rel of relationships) {
      if (rel.relationshipType === 'Belongs To' || rel.relationshipType === 'References') {
        if (rel.foreignKey && rel.foreignKeyType) {
          let fkZodType = 'z.number()';
          let fkColumnConfig = '';
          if (rel.foreignKeyType === 'String' || rel.foreignKeyType === 'string') {
            fkZodType = 'z.string()';
          } else if (baseTypeColumnDefaults.has(rel.foreignKeyType)) {
            fkZodType = rel.foreignKeyType === 'Uuid' ? 'z.uuid()' : 'z.string()';
            const columnType = baseTypeColumnDefaults.get(rel.foreignKeyType)!;
            fkColumnConfig = `\n      .column({ type: "${columnType.replace(/"/g, '\\"')}" })`;
          } else if (rel.foreignKeyType === 'Serial' || isPostgres) {
            fkColumnConfig = '\n      .column({ type: "INTEGER" })';
          }

          // Check if the FK property is optional on the BO class
          const fkProp = boClass?.getProperty(rel.foreignKey);
          const fkOptional = fkProp?.hasQuestionToken() ? '\n      .nullable()\n      .optional()' : '';

          const fkDescription = `Foreign key to ${rel.businessObjectName}`;
          schemaProps.push(`    ${rel.foreignKey}: ${fkZodType}${fkOptional}${fkColumnConfig}\n      .hidden()\n      .describe("${fkDescription}")`);
        }
      }
    }

    // Add relationship properties
    for (const rel of relationships) {
      let relExpression = '';
      if (rel.relationshipType === 'Belongs To') {
        relExpression = `belongsTo("${rel.businessObjectName}")`;
      } else if (rel.relationshipType === 'Has Many') {
        if (rel.foreignKey) {
          relExpression = `hasMany("${rel.businessObjectName}", "${rel.foreignKey}")`;
        } else {
          relExpression = `hasMany("${rel.businessObjectName}")`;
        }
      } else if (rel.relationshipType === 'Has One') {
        if (rel.foreignKey) {
          relExpression = `hasOne("${rel.businessObjectName}", "${rel.foreignKey}")`;
        } else {
          relExpression = `hasOne("${rel.businessObjectName}")`;
        }
      } else if (rel.relationshipType === 'References') {
        if (rel.foreignKey) {
          relExpression = `references("${rel.businessObjectName}", "${rel.foreignKey}")`;
        } else {
          relExpression = `references("${rel.businessObjectName}")`;
        }
      }

      schemaProps.push(`    ${rel.relationshipName}: ${relExpression}`);
    }

    // Add deferred schema-tools import (after property processing populates imports set)
    if (imports.size > 0) {
      const importList = Array.from(imports).sort().join(',\n  ');
      lines.push(`import {\n  ${importList},\n} from "@apexdesigner/schema-tools";`);
    }

    lines.push('');

    // Create the schema declaration with .describe() and .as()
    const description = boClass ? getDescription(boClass) : undefined;
    const entityDescription = description || className;

    // Detect setView() for view-backed BOs
    const viewCall = getModuleLevelCall(metadata.sourceFile, 'setView');
    const viewSql = viewCall ? getTemplateString(viewCall) : undefined;
    debug('viewSql %j', viewSql);

    lines.push(`export const ${schemaVarName} = z`);
    lines.push('  .object({');
    lines.push(schemaProps.join(',\n\n'));
    lines.push('  })');
    lines.push(`  .describe("${entityDescription.replace(/"/g, '\\"').replace(/\n/g, ' ')}")`);
    if (viewSql) {
      const escapedSql = viewSql.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
      lines.push(`  .view({ sql: \`${escapedSql}\` })`);
      lines.push(`  .as("${className}");`);
    } else {
      lines.push(`  .as("${className}");`);
    }
    lines.push('');
    lines.push(`export { ${schemaVarName} as ${schemaVarName}Schema };`);

    const content = lines.join('\n');
    debug('Generated schema file for %j', metadata.name);

    return content;
  }
};

export { businessObjectSchemaGenerator };
