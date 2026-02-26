import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassByBase } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import { Project, QuoteKind, SyntaxKind } from 'ts-morph';
import createDebug from 'debug';
import { captureBoImports, processPropertyDecorators, transformOnChangeProperties, addBoImports } from './property-processing.js';

const Debug = createDebug('ad3:generators:service');

/** Strip 'Service' suffix to get the base name */
function getBaseName(name: string): string {
  return name.replace(/Service$/, '');
}

const serviceGenerator: DesignGenerator = {
  name: 'service',

  triggers: [
    {
      metadataType: 'Service',
    },
  ],

  outputs: (metadata: DesignMetadata) => {
    const baseName = getBaseName(metadata.name);
    const serviceName = kebabCase(baseName);
    return [
      `client/src/app/services/${serviceName}/${serviceName}.service.ts`,
    ];
  },

  async generate(metadata: DesignMetadata, context: GenerationContext): Promise<Map<string, string>> {
    const debug = Debug.extend('generate');
    debug('generating service for %j', metadata.name);

    const sourceFile = metadata.sourceFile;
    const baseName = getBaseName(metadata.name);
    const serviceName = kebabCase(baseName);

    // Create a writable copy using ts-morph
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { target: 99, module: 99 },
      manipulationSettings: { quoteKind: QuoteKind.Single },
    });
    const writableFile = project.createSourceFile('temp.ts', sourceFile.getText());

    // Get the exported class
    const exportedClass = writableFile.getClasses().find(cls => cls.isExported());
    if (!exportedClass) {
      throw new Error(`Could not find exported class in ${metadata.name}`);
    }

    // Capture BO imports before removing design aliases
    const boNamedImports = captureBoImports(writableFile);
    debug('captured bo imports %j', boNamedImports);

    // Capture @services imports before removal (for service injection)
    const serviceImports: { name: string; typeName: string }[] = [];
    const servicesImportDecl = writableFile.getImportDeclaration(
      imp => imp.getModuleSpecifierValue() === '@services'
    );
    if (servicesImportDecl) {
      for (const named of servicesImportDecl.getNamedImports()) {
        serviceImports.push({ name: named.getName(), typeName: named.getName() });
      }
    }
    debug('captured service imports %j', serviceImports);

    // Build set of service type names for identifying service-typed properties
    const serviceTypeNames = new Set(serviceImports.map(s => s.typeName));
    // Also include all known Service metadata names
    for (const m of (context.listMetadata('Service') || [])) {
      serviceTypeNames.add(m.name);
    }

    // Remove DSL and design-time alias imports
    const designImports = writableFile.getImportDeclarations().filter(imp => {
      const moduleSpec = imp.getModuleSpecifierValue();
      if (moduleSpec.startsWith('@apexdesigner/dsl')) return true;
      if (moduleSpec.startsWith('@') && !moduleSpec.includes('/')) return true;
      return false;
    });
    for (const imp of designImports) {
      imp.remove();
    }

    // Process @property decorators
    const { autoReadProperties, formGroupProperties, persistedArrayProperties, onChangeCallMap } =
      processPropertyDecorators(exportedClass);
    debug('autoRead %j, formGroups %j, persistedArrays %j',
      autoReadProperties.length, formGroupProperties.length, persistedArrayProperties.length);

    // Transform onChangeCall properties into getter/setter with private backing field
    transformOnChangeProperties(exportedClass, onChangeCallMap);

    // Process @method decorators — collect callOnLoad methods and remove decorators
    const callOnLoadMethods: string[] = [];

    for (const classMethod of exportedClass.getMethods()) {
      const methodDecorator = classMethod.getDecorator('method');
      if (!methodDecorator) continue;

      const args = methodDecorator.getArguments();
      if (args.length > 0) {
        const argText = args[0].getText();
        if (argText.includes('callOnLoad: true') || argText.includes('callOnLoad:true')) {
          callOnLoadMethods.push(classMethod.getName());
          debug('callOnLoad method %j', classMethod.getName());
        }
      }

      methodDecorator.remove();
    }

    // Transform debug pattern: design uses `const debug = createDebug(...)`,
    // output uses `const Debug = createDebug(...)` + `const debug = Debug.extend('methodName')` per method
    const createDebugStatements = writableFile.getVariableStatements().filter(vs => {
      const decl = vs.getDeclarations()[0];
      if (!decl) return false;
      const init = decl.getInitializer();
      if (!init) return false;
      return decl.getName() === 'debug' && init.getText().startsWith('createDebug(');
    });

    if (createDebugStatements.length > 0) {
      const debugDecl = createDebugStatements[0].getDeclarations()[0];
      debugDecl.getNameNode().replaceWithText('Debug');

      for (const classMethod of exportedClass.getMethods()) {
        const bodyText = classMethod.getBodyText() || '';
        if (bodyText.includes('debug(')) {
          classMethod.insertStatements(0, `const debug = Debug.extend('${classMethod.getName()}');`);
        }
      }
    }

    // Remove extends Service
    if (exportedClass.getExtends()) {
      exportedClass.removeExtends();
    }

    // Initialize form group properties with new instances
    for (const fg of formGroupProperties) {
      const prop = exportedClass.getProperty(fg.name);
      if (!prop) continue;
      if (prop.hasQuestionToken()) prop.setHasQuestionToken(false);
      if (prop.hasExclamationToken()) prop.setHasExclamationToken(false);
      prop.setInitializer(`new ${fg.typeName}()`);
    }

    // Initialize persisted array properties with new instances
    for (const pa of persistedArrayProperties) {
      const prop = exportedClass.getProperty(pa.name);
      if (!prop) continue;
      if (prop.hasQuestionToken()) prop.setHasQuestionToken(false);
      if (prop.hasExclamationToken()) prop.setHasExclamationToken(false);
      prop.setInitializer(`new ${pa.typeName}()`);
    }

    // Convert service-typed properties to inject() calls
    const injectedServices: { propName: string; typeName: string; serviceFile: string }[] = [];
    for (const prop of exportedClass.getProperties()) {
      const typeNode = prop.getTypeNode();
      if (!typeNode) continue;
      const typeText = typeNode.getText();
      if (serviceTypeNames.has(typeText)) {
        const propName = prop.getName();
        const svcBaseName = typeText.replace(/Service$/, '');
        const svcFile = kebabCase(svcBaseName);
        injectedServices.push({ propName, typeName: typeText, serviceFile: svcFile });

        // Replace the entire property declaration text to remove the type annotation
        prop.replaceWithText(`${propName} = inject(${typeText})`);
        debug('injected service %j: %j', propName, typeText);
      }
    }

    // Determine what Angular imports are needed
    const angularCoreImports: string[] = ['Injectable'];
    const hasAutoSaveFormGroups = formGroupProperties.some(fg => fg.saveMode === 'Automatically');
    const hasPersistedArrayAutoRead = persistedArrayProperties.some(pa => pa.readMode === 'Automatically');
    const needsInject = injectedServices.length > 0 || hasAutoSaveFormGroups;
    if (needsInject) {
      angularCoreImports.push('inject');
    }
    if (hasAutoSaveFormGroups) {
      angularCoreImports.push('DestroyRef');
    }

    // Build constructor for initialization if needed
    const needsInit = autoReadProperties.length > 0 || callOnLoadMethods.length > 0 ||
      hasAutoSaveFormGroups || hasPersistedArrayAutoRead;

    if (needsInit) {
      // Find insertion point: after properties, before design methods
      const members = exportedClass.getMembers();
      let insertIndex = members.length;
      for (let i = 0; i < members.length; i++) {
        if (members[i].getKind() === SyntaxKind.MethodDeclaration) {
          insertIndex = i;
          break;
        }
      }

      const initLines: string[] = [];

      // Auto-save wiring
      for (const fg of formGroupProperties) {
        if (fg.saveMode === 'Automatically') {
          initLines.push(`this.${fg.name}.autoSave(this.destroyRef);`);
        }
      }

      // Persisted array reads
      for (const pa of persistedArrayProperties) {
        if (pa.readMode === 'Automatically') {
          const readArg = pa.order ? `{ order: ${pa.order} }` : '';
          initLines.push(`await this.${pa.name}.read(${readArg});`);
          if (pa.afterReadCall) initLines.push(`this.${pa.afterReadCall}();`);
        }
      }

      // callOnLoad methods
      for (const methodName of callOnLoadMethods) {
        initLines.push(`this.${methodName}();`);
      }

      const constructorLines: string[] = [];
      if (hasAutoSaveFormGroups) {
        constructorLines.push('');
        constructorLines.push(`private destroyRef = inject(DestroyRef);`);
        constructorLines.push('');
      }
      const hasAwait = autoReadProperties.length > 0 || hasPersistedArrayAutoRead;
      if (hasAwait) {
        const initBody = initLines.join('\n      ');
        constructorLines.push(`constructor() {\n    (async () => {\n      ${initBody}\n    })();\n  }`);
      } else {
        const initBody = initLines.join('\n    ');
        constructorLines.push(`constructor() {\n    ${initBody}\n  }`);
      }
      exportedClass.insertMember(insertIndex, constructorLines.join('\n  '));
    }

    // Add @Injectable decorator
    exportedClass.addDecorator({
      name: 'Injectable',
      arguments: [`{ providedIn: 'root' }`],
    });

    // Add Angular import at top
    writableFile.insertImportDeclaration(0, {
      moduleSpecifier: '@angular/core',
      namedImports: angularCoreImports,
    });

    // Add business object imports
    const boImports = new Set<string>();
    for (const name of boNamedImports) boImports.add(name);
    for (const prop of autoReadProperties) boImports.add(prop.typeName);
    for (const pa of persistedArrayProperties) boImports.add(pa.typeName);
    for (const fg of formGroupProperties) boImports.add(fg.typeName);
    addBoImports(writableFile, boImports, '../../business-objects');

    // Add service imports (re-map @services -> relative paths)
    for (const svc of injectedServices) {
      writableFile.addImportDeclaration({
        moduleSpecifier: `../${svc.serviceFile}/${svc.serviceFile}.service`,
        namedImports: [svc.typeName],
      });
    }

    // Build output
    const outputs = new Map<string, string>();
    outputs.set(
      `client/src/app/services/${serviceName}/${serviceName}.service.ts`,
      writableFile.getText(),
    );

    return outputs;
  },
};

export { serviceGenerator };
