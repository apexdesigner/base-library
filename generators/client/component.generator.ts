import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getModuleLevelCall, getTemplateString } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import { Node, Project, QuoteKind, SyntaxKind } from 'ts-morph';
import createDebug from 'debug';
import { getTemplateImports, convertAd3Template } from '@apexdesigner/generator';
import { captureBoImports, processPropertyDecorators, transformOnChangeProperties, addBoImports } from './property-processing.js';

const Debug = createDebug('ad3:generators:component');

/** Strip 'Component' suffix to get the base name */
function getBaseName(name: string): string {
  return name.replace(/Component$/, '');
}

const componentGenerator: DesignGenerator = {
  name: 'component',

  triggers: [
    {
      metadataType: 'Component'
    }
  ],

  outputs: (metadata: DesignMetadata) => {
    const baseName = getBaseName(metadata.name);
    const isAppComponent = baseName === 'App';
    const componentName = isAppComponent ? 'app' : kebabCase(baseName);

    if (isAppComponent) {
      return [`client/src/app/app.component.ts`, `client/src/app/app.component.html`, `client/src/app/app.component.scss`];
    }

    return [
      `client/src/app/components/${componentName}/${componentName}.component.ts`,
      `client/src/app/components/${componentName}/${componentName}.component.html`,
      `client/src/app/components/${componentName}/${componentName}.component.scss`
    ];
  },

  async generate(metadata: DesignMetadata, context: GenerationContext): Promise<Map<string, string>> {
    const debug = Debug.extend('generate');
    debug('generating component for %j', metadata.name);

    const sourceFile = metadata.sourceFile;
    const baseName = getBaseName(metadata.name);
    const isAppComponent = baseName === 'App';
    const componentName = isAppComponent ? 'app' : kebabCase(baseName);
    const selector = isAppComponent ? 'app-root' : kebabCase(baseName);
    const outputFilePath = isAppComponent
      ? 'client/src/app/app.component.ts'
      : `client/src/app/components/${componentName}/${componentName}.component.ts`;

    // Extract template from applyTemplate call
    let template = '';
    const applyTemplateCall = getModuleLevelCall(sourceFile, 'applyTemplate');
    if (applyTemplateCall) {
      template = getTemplateString(applyTemplateCall) || '';
      debug('extracted template (%j chars)', template.length);
    }

    // Extract styles from applyStyles call
    let styles = '';
    const applyStylesCall = getModuleLevelCall(sourceFile, 'applyStyles');
    if (applyStylesCall) {
      styles = getTemplateString(applyStylesCall) || '';
      debug('extracted styles (%j chars)', styles.length);
    }

    // Convert AD3 template syntax to Angular control flow
    const convertedTemplate = convertAd3Template(template);

    // Create a writable copy using ts-morph
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { target: 99, module: 99 },
      manipulationSettings: { quoteKind: QuoteKind.Single }
    });
    const writableFile = project.createSourceFile('temp.ts', sourceFile.getText());

    // Get the exported class
    const exportedClass = writableFile.getClasses().find(cls => cls.isExported());
    if (!exportedClass) {
      throw new Error(`Could not find exported class in ${metadata.name}`);
    }

    // Get template imports (resolve element/directive/pipe usage against extracted interfaces)
    const templateImports = await getTemplateImports(exportedClass, context, 'component', outputFilePath, template);
    debug('template requires %j import groups', templateImports.length);

    // Capture @business-objects / @business-objects-client imports before removing design aliases
    const boNamedImports = captureBoImports(writableFile);
    debug('captured bo imports %j', boNamedImports);

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

    // Remove applyTemplate and applyStyles calls
    const callExpressions = writableFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of [...callExpressions]) {
      const exprText = call.getExpression().getText();
      if (exprText === 'applyTemplate' || exprText === 'applyStyles') {
        const statement = call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
        if (statement) {
          statement.remove();
        }
      }
    }

    // Extract selector override from @component decorator before removing it
    const componentDecorator = exportedClass.getDecorator('component');
    if (componentDecorator) {
      const decoratorArgs = componentDecorator.getArguments();
      if (decoratorArgs.length > 0) {
        const configText = decoratorArgs[0].getText();
        const selectorMatch = configText.match(/selector:\s*["']([^"']+)["']/);
        if (selectorMatch) {
          debug('extracted selector override: %j', selectorMatch[1]);
        }
      }
      componentDecorator.remove();
    }

    // Remove extends Component
    if (exportedClass.getExtends()) {
      exportedClass.removeExtends();
    }

    // Remove implements clauses (DSL-level)
    for (const impl of exportedClass.getImplements()) {
      exportedClass.removeImplements(impl);
    }

    // Process @property decorators
    const { autoReadProperties, formGroupProperties, persistedArrayProperties, onChangeCallMap, inputProperties, outputProperties } =
      processPropertyDecorators(exportedClass);
    debug('autoRead %j, formGroups %j, persistedArrays %j, inputs %j, outputs %j',
      autoReadProperties.length, formGroupProperties.length, persistedArrayProperties.length,
      inputProperties.length, outputProperties.length);

    // Angular core extras to collect
    const angularCoreExtras: string[] = [];

    // Apply @Input() to input properties
    for (const propName of inputProperties) {
      const prop = exportedClass.getProperty(propName);
      if (prop) {
        prop.addDecorator({ name: 'Input', arguments: [] });
        if (!angularCoreExtras.includes('Input')) angularCoreExtras.push('Input');
      }
    }

    // Apply @Output() to output properties — replace with EventEmitter
    for (const propName of outputProperties) {
      const prop = exportedClass.getProperty(propName);
      if (prop) {
        prop.setHasExclamationToken(false);
        prop.setHasQuestionToken(false);
        prop.setInitializer('new EventEmitter<any>()');
        prop.setType('EventEmitter<any>');
        prop.addDecorator({ name: 'Output', arguments: [] });
        if (!angularCoreExtras.includes('Output')) angularCoreExtras.push('Output');
        if (!angularCoreExtras.includes('EventEmitter')) angularCoreExtras.push('EventEmitter');
      }
    }

    // Transform onChangeCall properties into getter/setter
    transformOnChangeProperties(exportedClass, onChangeCallMap);

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

    // Check for content children: property typed as ComponentName[] (no @property decorator)
    const contentChildrenProps: { name: string; typeName: string; componentFile: string }[] = [];
    const componentNames = new Set((context.listMetadata('Component') || []).map(m => m.name));

    for (const prop of exportedClass.getProperties()) {
      // Skip properties that already have Angular decorators applied
      if (prop.getDecorator('Input') || prop.getDecorator('Output')) continue;

      const typeNode = prop.getTypeNode();
      if (typeNode) {
        const typeText = typeNode.getText();
        const arrayMatch = typeText.match(/^(\w+)\[\]$/);
        if (arrayMatch && componentNames.has(arrayMatch[1])) {
          const childTypeName = arrayMatch[1];
          const childBaseName = getBaseName(childTypeName);
          const childFile = kebabCase(childBaseName);
          contentChildrenProps.push({
            name: prop.getName(),
            typeName: childTypeName,
            componentFile: childFile
          });
          debug('content children property %j: %j', prop.getName(), childTypeName);

          const propName = prop.getName();
          prop.remove();

          exportedClass.addProperty({
            name: `_${propName}Components`,
            type: `QueryList<${childTypeName}>`,
            hasExclamationToken: true,
            decorators: [{ name: 'ContentChildren', arguments: [childTypeName] }]
          });

          exportedClass.addProperty({
            name: propName,
            type: `${childTypeName}[]`,
            initializer: '[]'
          });

          angularCoreExtras.push('ContentChildren', 'QueryList', 'AfterContentInit');
        }
      }
    }

    // Process @method decorators
    const callOnLoadMethods: string[] = [];
    const callAfterLoadMethods: string[] = [];
    const callOnUnloadMethods: string[] = [];
    for (const meth of exportedClass.getMethods()) {
      const methodDecorator = meth.getDecorator('method');
      if (methodDecorator) {
        const args = methodDecorator.getArguments();
        if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
          const callOnLoadProp = args[0].getProperty('callOnLoad');
          if (callOnLoadProp && Node.isPropertyAssignment(callOnLoadProp)) {
            if (callOnLoadProp.getInitializerOrThrow().getText() === 'true') {
              callOnLoadMethods.push(meth.getName());
            }
          }
          const callAfterLoadProp = args[0].getProperty('callAfterLoad');
          if (callAfterLoadProp && Node.isPropertyAssignment(callAfterLoadProp)) {
            if (callAfterLoadProp.getInitializerOrThrow().getText() === 'true') {
              callAfterLoadMethods.push(meth.getName());
            }
          }
          const callOnUnloadProp = args[0].getProperty('callOnUnload');
          if (callOnUnloadProp && Node.isPropertyAssignment(callOnUnloadProp)) {
            if (callOnUnloadProp.getInitializerOrThrow().getText() === 'true') {
              callOnUnloadMethods.push(meth.getName());
            }
          }
        }
        methodDecorator.remove();
      }
    }

    // Check if the source file has debug setup and rename debug -> Debug
    const debugVarDecl = writableFile.getVariableDeclarations().find(v => v.getInitializer()?.getText().includes('createDebug') ?? false);
    const hasDebug = !!debugVarDecl;

    if (hasDebug) {
      for (const meth of exportedClass.getMethods()) {
        const body = meth.getBody();
        if (body && body.getText().includes('debug(')) {
          meth.insertStatements(0, `const debug = Debug.extend('${meth.getName()}');`);
        }
      }
    }

    if (debugVarDecl && debugVarDecl.getName() === 'debug') {
      debugVarDecl.getNameNode().replaceWithText('Debug');
    }

    // Add ngOnInit for autoRead + persisted array reads + callOnLoad
    const hasPersistedArrayAutoRead = persistedArrayProperties.some(pa => pa.readMode === 'Automatically');
    const hasAutoSaveFormGroups = formGroupProperties.some(fg => fg.saveMode === 'Automatically');
    const needsOnInit = autoReadProperties.length > 0 || hasPersistedArrayAutoRead || callOnLoadMethods.length > 0 || hasAutoSaveFormGroups;

    if (needsOnInit) {
      angularCoreExtras.push('OnInit');
      exportedClass.addImplements('OnInit');

      const initLines: string[] = [];

      if (hasAutoSaveFormGroups) {
        angularCoreExtras.push('inject', 'DestroyRef');
        for (const fg of formGroupProperties) {
          if (fg.saveMode === 'Automatically') {
            initLines.push(`this.${fg.name}.autoSave(this.destroyRef);`);
          }
        }
      }

      for (const prop of autoReadProperties) {
        if (prop.isArray) {
          initLines.push(`this.${prop.name} = await ${prop.typeName}.find();`);
        } else {
          initLines.push(`// TODO: load ${prop.name}`);
        }
      }

      for (const pa of persistedArrayProperties) {
        if (pa.readMode === 'Automatically') {
          const readArg = pa.order ? `{ order: ${pa.order} }` : '';
          initLines.push(`await this.${pa.name}.read(${readArg});`);
          if (pa.afterReadCall) initLines.push(`this.${pa.afterReadCall}();`);
        }
      }

      for (const methodName of callOnLoadMethods) {
        initLines.push(`this.${methodName}();`);
      }

      const isAsync = autoReadProperties.length > 0 || hasPersistedArrayAutoRead;
      exportedClass.addMethod({
        name: 'ngOnInit',
        isAsync,
        returnType: isAsync ? 'Promise<void>' : 'void',
        statements: initLines,
      });
    }

    // Add ngAfterViewInit for callAfterLoad methods
    if (callAfterLoadMethods.length > 0) {
      angularCoreExtras.push('AfterViewInit');
      exportedClass.addImplements('AfterViewInit');
      exportedClass.addMethod({
        name: 'ngAfterViewInit',
        returnType: 'void',
        statements: callAfterLoadMethods.map(m => `this.${m}();`)
      });
    }

    // Add ngOnDestroy for callOnUnload methods
    if (callOnUnloadMethods.length > 0) {
      angularCoreExtras.push('OnDestroy');
      exportedClass.addImplements('OnDestroy');
      exportedClass.addMethod({
        name: 'ngOnDestroy',
        returnType: 'void',
        statements: callOnUnloadMethods.map(m => `this.${m}();`)
      });
    }

    // Add ngAfterContentInit if content children exist
    if (contentChildrenProps.length > 0) {
      exportedClass.addImplements('AfterContentInit');
      const bodyLines: string[] = [];
      if (hasDebug) {
        bodyLines.push(`const debug = Debug.extend('ngAfterContentInit');`);
      }
      for (const cp of contentChildrenProps) {
        bodyLines.push(`this.${cp.name} = this._${cp.name}Components.toArray();`);
        if (hasDebug) {
          bodyLines.push(`debug('this.${cp.name}', this.${cp.name});`);
        }
        bodyLines.push(`this._${cp.name}Components.changes.subscribe(() => {`);
        bodyLines.push(`  this.${cp.name} = this._${cp.name}Components.toArray();`);
        if (hasDebug) {
          bodyLines.push(`  debug('this.${cp.name}', this.${cp.name});`);
        }
        bodyLines.push(`});`);
      }
      exportedClass.addMethod({
        name: 'ngAfterContentInit',
        returnType: 'void',
        statements: bodyLines.join('\n')
      });
    }

    // Add DestroyRef injection field if needed (after ngOnInit is added)
    if (hasAutoSaveFormGroups) {
      const members = exportedClass.getMembers();
      const firstMethod = members.findIndex(m => m.getKind() === SyntaxKind.MethodDeclaration);
      const insertIndex = firstMethod >= 0 ? firstMethod : members.length;
      exportedClass.insertMember(insertIndex, `private destroyRef = inject(DestroyRef);`);
    }

    // Add Angular Component import
    const angularCoreImports = ['Component', ...new Set(angularCoreExtras)];
    writableFile.insertImportDeclaration(0, {
      moduleSpecifier: '@angular/core',
      namedImports: angularCoreImports
    });

    // Add imports for content children component types
    for (const cp of contentChildrenProps) {
      writableFile.addImportDeclaration({
        moduleSpecifier: `../${cp.componentFile}/${cp.componentFile}.component`,
        namedImports: [cp.typeName]
      });
    }

    // Add business object imports
    const boRelativePath = isAppComponent ? './business-objects' : '../../business-objects';
    const boImports = new Set<string>();
    for (const name of boNamedImports) boImports.add(name);
    for (const prop of autoReadProperties) boImports.add(prop.typeName);
    for (const pa of persistedArrayProperties) boImports.add(pa.typeName);
    for (const fg of formGroupProperties) boImports.add(fg.typeName);
    addBoImports(writableFile, boImports, boRelativePath);

    // Add template-based imports (file-level)
    for (const templateImport of templateImports) {
      const existingImport = writableFile.getImportDeclaration(imp => imp.getModuleSpecifierValue() === templateImport.moduleSpecifier);

      if (!existingImport) {
        writableFile.addImportDeclaration({
          moduleSpecifier: templateImport.moduleSpecifier,
          namedImports: templateImport.namedImports
        });
      } else {
        const existingNamedImports = existingImport.getNamedImports().map(ni => ni.getName());
        templateImport.namedImports.forEach(importName => {
          if (!existingNamedImports.includes(importName)) {
            existingImport.addNamedImport(importName);
          }
        });
      }
    }

    // Build imports array for @Component decorator
    const componentImports: string[] = [];
    templateImports.forEach(imp => {
      componentImports.push(...imp.namedImports);
    });
    componentImports.sort((a, b) => a.localeCompare(b));

    // Build @Component decorator config
    let decoratorConfig = `{\n  selector: '${selector}',\n  templateUrl: './${componentName}.component.html',\n  styleUrls: ['./${componentName}.component.scss']`;

    if (componentImports.length > 0) {
      decoratorConfig += `,\n  imports: [${componentImports.join(', ')}]`;
    }

    decoratorConfig += `\n}`;

    exportedClass.addDecorator({
      name: 'Component',
      arguments: [decoratorConfig]
    });

    // Build output paths
    const prefix = isAppComponent ? 'client/src/app/app' : `client/src/app/components/${componentName}/${componentName}`;

    // Build output files
    const outputs = new Map<string, string>();
    outputs.set(`${prefix}.component.ts`, writableFile.getText());
    outputs.set(`${prefix}.component.html`, convertedTemplate.trim());
    outputs.set(`${prefix}.component.scss`, styles);

    return outputs;
  }
};

export { componentGenerator };
