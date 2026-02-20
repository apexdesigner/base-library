import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getDataSource, getIdProperty, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase, getDescription, getPropertyDecorator, getObjectLiteralValue } from '@apexdesigner/utilities';
import { kebabCase, pascalCase, camelCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:businessObjectSchema');

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
        if (isLibrary(metadata)) return false;
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

    let idZodType = 'z.number()';
    let idColumnConfig = '';
    if (idProperty.type === 'string' || idProperty.type === 'String') {
      idZodType = 'z.string()';
    } else if (idProperty.type === 'Serial') {
      idColumnConfig = '.column({ autoIncrement: true })';
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
      } else {
        // Infer from data source: Postgres numeric ids default to autoIncrement
        const ds = getDataSource(metadata.sourceFile, context);
        if (ds) {
          const dsClass = getClassByBase(ds.sourceFile, 'DataSource');
          if (dsClass) {
            const config = getObjectLiteralValue(dsClass, 'configuration');
            if (config?.persistenceType === 'Postgres') {
              idColumnConfig = '.column({ autoIncrement: true })';
            }
          }
        }
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

      if (isOptional) chain.push('.optional()');
      if (opts.column && typeof opts.column === 'object') chain.push(`.column(${toObjectLiteral(opts.column as Record<string, unknown>)})`);
      if (opts.hidden) chain.push('.hidden()');
      if (opts.required) chain.push('.requiredFinal()');
      if (opts.disabled) chain.push('.disabled()');
      if (opts.displayName) chain.push(`.displayName("${String(opts.displayName).replace(/"/g, '\\"')}")`);
      if (opts.placeholder) chain.push(`.placeholder("${String(opts.placeholder).replace(/"/g, '\\"')}")`);
      if (opts.helpText) chain.push(`.helpText("${String(opts.helpText).replace(/"/g, '\\"')}")`);
      if (opts.presentAs) chain.push(`.presentAs("${String(opts.presentAs).replace(/"/g, '\\"')}")`);

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
        }

        // Get @property() decorator options
        const opts = getPropertyDecorator(prop, 'property') || {};
        debug('mixin property %j opts %j', propName, opts);

        const chain: string[] = [zodType];

        if (isOptional) chain.push('.optional()');
        if (opts.column && typeof opts.column === 'object') chain.push(`.column(${toObjectLiteral(opts.column as Record<string, unknown>)})`);
        if (opts.hidden) chain.push('.hidden()');
        if (opts.required) chain.push('.requiredFinal()');
        if (opts.disabled) chain.push('.disabled()');
        if (opts.displayName) chain.push(`.displayName("${String(opts.displayName).replace(/"/g, '\\"')}")`);
        if (opts.placeholder) chain.push(`.placeholder("${String(opts.placeholder).replace(/"/g, '\\"')}")`);
        if (opts.helpText) chain.push(`.helpText("${String(opts.helpText).replace(/"/g, '\\"')}")`);
        if (opts.presentAs) chain.push(`.presentAs("${String(opts.presentAs).replace(/"/g, '\\"')}")`);

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
          } else if (rel.foreignKeyType === 'Serial') {
            fkColumnConfig = '\n      .column({ type: "INTEGER" })';
          }

          const fkDescription = `Foreign key to ${rel.businessObjectName}`;
          schemaProps.push(`    ${rel.foreignKey}: ${fkZodType}${fkColumnConfig}\n      .hidden()\n      .describe("${fkDescription}")`);
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

    lines.push(`export const ${schemaVarName} = z`);
    lines.push('  .object({');
    lines.push(schemaProps.join(',\n\n'));
    lines.push('  })');
    lines.push(`  .describe("${entityDescription.replace(/"/g, '\\"')}")`);
    lines.push(`  .as("${className}");`);
    lines.push('');
    lines.push(`export { ${schemaVarName} as ${schemaVarName}Schema };`);

    const content = lines.join('\n');
    debug('Generated schema file for %j', metadata.name);

    return content;
  }
};

export { businessObjectSchemaGenerator };
