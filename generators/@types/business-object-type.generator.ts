import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary, getIdProperty, resolveRelationships, resolveMixins } from '@apexdesigner/generator';
import { getClassByBase, getDescription, getBehaviorFunction, getBehaviorOptions, getBehaviorParent } from '@apexdesigner/utilities';
import { kebabCase, pascalCase } from 'change-case';
import { Project, StructureKind } from 'ts-morph';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:businessObjectType');

// Lifecycle behavior types to exclude
const LIFECYCLE_TYPES = new Set([
  'Before Create',
  'After Create',
  'Before Update',
  'After Update',
  'Before Delete',
  'After Delete',
  'Before Read',
  'After Read',
  'After Start',
]);

const businessObjectTypeGenerator: DesignGenerator = {
  name: 'business-object-type',

  triggers: [
    {
      metadataType: 'BusinessObject',
      condition: (metadata) => !isLibrary(metadata),
    }
  ],

  outputs: (metadata: DesignMetadata) => [
    `design/@types/business-objects/${kebabCase(metadata.name)}.d.ts`
  ],

  async generate(metadata: DesignMetadata, context: GenerationContext) {
    const debug = Debug.extend('generate');
    debug('START generate for %j', metadata.name);
    debug('sourceFile path %j', metadata.sourceFile.getFilePath());

    const className = pascalCase(metadata.name);
    debug('className %j', className);

    // Create a ts-morph project and source file
    debug('Creating ts-morph project');
    const project = new Project({
      useInMemoryFileSystem: true,
      skipFileDependencyResolution: true,
    });
    const sourceFile = project.createSourceFile('temp.d.ts', '', { overwrite: true });
    debug('Created source file');

    // Add header comment
    sourceFile.insertText(0, `// Generated type definitions for ${metadata.name} business object\n\n`);

    // Get relationships to determine imports
    const relationships = resolveRelationships(metadata.sourceFile, context);
    debug('relationships count %j', relationships.length);

    // Collect all referenced business object types for imports
    const referencedTypes = new Set<string>();
    relationships.forEach(rel => {
      if (rel.businessObjectName !== className) {
        referencedTypes.add(rel.businessObjectName);
      }
    });

    // Add imports for referenced types
    if (referencedTypes.size > 0) {
      const importDecls = Array.from(referencedTypes)
        .sort()
        .map(typeName => ({
          kind: StructureKind.ImportDeclaration,
          isTypeOnly: true,
          moduleSpecifier: `./${kebabCase(typeName)}`,
          namedImports: [typeName],
        }));

      sourceFile.addImportDeclarations(importDecls);
    }

    // Add import for persistence filter types
    sourceFile.addImportDeclaration({
      kind: StructureKind.ImportDeclaration,
      isTypeOnly: true,
      moduleSpecifier: '@apexdesigner/schema-persistence',
      namedImports: ['FindFilter', 'FindOneFilter', 'UpdateFilter', 'DeleteFilter'],
    });

    // Get description and add as comment
    const boClass = getClassByBase(metadata.sourceFile, 'BusinessObject');
    const description = boClass ? getDescription(boClass) : undefined;
    if (description) {
      sourceFile.addStatements(`// ${description.split('\n').join('\n// ')}\n`);
    }

    // Create the class declaration
    const classDecl = sourceFile.addClass({
      name: className,
      isExported: true,
      hasDeclareKeyword: true,
    });

    // Add id property
    const idProperty = getIdProperty(metadata.sourceFile, context);
    debug('idProperty %j', idProperty);

    let idType = 'number';
    if (idProperty.type === 'string' || idProperty.type === 'String') {
      idType = 'string';
    }

    classDecl.addProperty({
      name: idProperty.name,
      type: idType,
    });

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

    // Add scalar properties
    for (const prop of properties) {
      const propName = prop.getName();
      if (skipNames.has(propName)) continue;

      let propType = prop.getType().getText();
      propType = propType.replace(' | undefined', '');

      classDecl.addProperty({
        name: propName,
        type: propType,
        hasQuestionToken: prop.hasQuestionToken(),
      });
    }

    // Add mixin properties
    const mixins = resolveMixins(metadata.sourceFile, context);
    const mixinNames = mixins.map(m => m.name);
    debug('mixins %j', mixinNames);
    for (const mixin of mixins) {
      const mixinClass = getClassByBase(mixin.metadata.sourceFile, 'Mixin');
      if (!mixinClass) continue;
      for (const prop of mixinClass.getProperties()) {
        const propName = prop.getName();
        if (skipNames.has(propName)) continue;

        let propType = prop.getType().getText();
        propType = propType.replace(' | undefined', '');

        classDecl.addProperty({
          name: propName,
          type: propType,
          hasQuestionToken: prop.hasQuestionToken(),
        });
      }
    }

    // Add foreign keys and relationships
    for (const rel of relationships) {
      if (rel.relationshipType === 'Belongs To' || rel.relationshipType === 'References') {
        if (rel.foreignKey && rel.foreignKeyType) {
          let fkType = String(rel.foreignKeyType);
          if (fkType === 'Number' || fkType === 'number') {
            fkType = 'number';
          } else if (fkType === 'String' || fkType === 'string') {
            fkType = 'string';
          }

          classDecl.addProperty({
            name: rel.foreignKey,
            type: fkType,
          });
        }
      }

      const relProp = properties.find(p => p.getName() === rel.relationshipName);
      const hasQuestionToken = relProp?.hasQuestionToken() ?? false;

      if (rel.relationshipType === 'Has Many' || rel.relationshipType === 'Has One') {
        const arraySuffix = rel.relationshipType === 'Has Many' ? '[]' : '';
        classDecl.addProperty({
          name: rel.relationshipName,
          type: `${rel.businessObjectName}${arraySuffix}`,
          hasQuestionToken,
        });
      } else {
        classDecl.addProperty({
          name: rel.relationshipName,
          type: rel.businessObjectName,
          hasQuestionToken,
        });
      }
    }

    // Find and add behaviors (BO + mixin behaviors)
    const parentNames = new Set([className, ...mixinNames]);
    const allBehaviors = context.listMetadata('Behavior');
    debug('total behaviors in project %j', allBehaviors.length);

    for (const behavior of allBehaviors) {
      try {
        debug('processing behavior %j', behavior.name);
        const options = getBehaviorOptions(behavior.sourceFile);
        debug('behavior options %j', options);
        if (!options) {
          debug('no options for behavior %j', behavior.name);
          continue;
        }

        // Check if this behavior belongs to this business object or its mixins
        const parent = getBehaviorParent(behavior.sourceFile);
        debug('behavior parent %j, looking for %j', parent, Array.from(parentNames));
        if (!parentNames.has(parent)) {
          debug('parent mismatch, skipping');
          continue;
        }

        const func = getBehaviorFunction(behavior.sourceFile);
        debug('behavior func %j', func);
        if (!func) {
          debug('no func for behavior %j', behavior.name);
          continue;
        }

        // Skip lifecycle behaviors
        if (LIFECYCLE_TYPES.has(options.type)) {
          debug('skipping lifecycle behavior %j', func.name);
          continue;
        }

        const isStatic = options.type === 'Class';
        const isAsync = func.isAsync;

        // Get parameters (skip first param for instance methods as it's the instance)
        const params = func.parameters || [];
        const methodParams = isStatic ? params : params.slice(1);

        classDecl.addMethod({
          name: func.name,
          isStatic,
          parameters: methodParams.map(p => ({
            name: p.name,
            type: p.type || 'any',
          })),
          returnType: isAsync ? `Promise<${func.returnType || 'any'}>` : (func.returnType || 'any'),
        });

        debug('added behavior method %j (static: %j)', func.name, isStatic);
      } catch (err) {
        debug('error processing behavior %j: %j', behavior.name, err);
      }
    }

    // Add CRUD static methods based on @apexdesigner/schema-persistence API

    // Create methods
    classDecl.addMethod({
      name: 'create',
      isStatic: true,
      parameters: [{ name: 'data', type: `Partial<${className}>` }],
      returnType: `Promise<${className}>`,
    });

    classDecl.addMethod({
      name: 'createMany',
      isStatic: true,
      parameters: [{ name: 'data', type: `Partial<${className}>[]` }],
      returnType: `Promise<${className}[]>`,
    });

    // Find methods
    classDecl.addMethod({
      name: 'find',
      isStatic: true,
      parameters: [{ name: 'filter?', type: `FindFilter<${className}>` }],
      returnType: `Promise<${className}[]>`,
    });

    classDecl.addMethod({
      name: 'findOne',
      isStatic: true,
      parameters: [{ name: 'filter', type: `FindOneFilter<${className}>` }],
      returnType: `Promise<${className} | null>`,
    });

    classDecl.addMethod({
      name: 'findById',
      isStatic: true,
      parameters: [
        { name: 'id', type: `${idType} | string` },
        { name: 'filter?', type: `Pick<FindFilter<${className}>, 'include' | 'fields' | 'omit'>` }
      ],
      returnType: `Promise<${className}>`,
    });

    classDecl.addMethod({
      name: 'findOrCreate',
      isStatic: true,
      parameters: [{ name: 'options', type: `{ where: FindOneFilter<${className}>['where']; create: Partial<${className}> }` }],
      returnType: `Promise<{ entity: ${className}; created: boolean }>`,
    });

    // Count method
    classDecl.addMethod({
      name: 'count',
      isStatic: true,
      parameters: [{ name: 'filter?', type: `Pick<FindFilter<${className}>, 'where'>` }],
      returnType: `Promise<number>`,
    });

    // Update methods
    classDecl.addMethod({
      name: 'update',
      isStatic: true,
      parameters: [
        { name: 'filter', type: `UpdateFilter<${className}>` },
        { name: 'data', type: `Partial<${className}>` }
      ],
      returnType: `Promise<${className}[]>`,
    });

    classDecl.addMethod({
      name: 'updateById',
      isStatic: true,
      parameters: [
        { name: 'id', type: 'string' },
        { name: 'data', type: `Partial<${className}>` }
      ],
      returnType: `Promise<${className}>`,
    });

    // Upsert method
    classDecl.addMethod({
      name: 'upsert',
      isStatic: true,
      parameters: [{ name: 'options', type: `{ where: FindOneFilter<${className}>['where']; create: Partial<${className}>; update: Partial<${className}> }` }],
      returnType: `Promise<${className}>`,
    });

    // Delete methods
    classDecl.addMethod({
      name: 'delete',
      isStatic: true,
      parameters: [{ name: 'filter', type: `DeleteFilter<${className}>` }],
      returnType: `Promise<number>`,
    });

    classDecl.addMethod({
      name: 'deleteById',
      isStatic: true,
      parameters: [{ name: 'id', type: 'string' }],
      returnType: `Promise<boolean>`,
    });

    const content = sourceFile.getText();
    debug('Generated type file for %j', metadata.name);

    return content;
  }
};

export { businessObjectTypeGenerator };
