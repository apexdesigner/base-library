import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassDecorator, getClassByBase } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import { Node, Project, QuoteKind, SyntaxKind } from 'ts-morph';
import createDebug from 'debug';
import { captureBoImports, processPropertyDecorators, addBoImports } from './property-processing.js';

const Debug = createDebug('BaseLibrary:generators:directive');

function getBaseName(name: string): string {
  return name.replace(/Directive$/, '');
}

const directiveGenerator: DesignGenerator = {
  name: 'directive',

  triggers: [
    {
      metadataType: 'Directive'
    }
  ],

  outputs: (metadata: DesignMetadata) => {
    const baseName = getBaseName(metadata.name);
    const directiveName = kebabCase(baseName);
    return [`client/src/app/directives/${directiveName}/${directiveName}.directive.ts`];
  },

  async generate(metadata: DesignMetadata, context: GenerationContext): Promise<Map<string, string>> {
    const debug = Debug.extend('generate');
    debug('generating directive for %j', metadata.name);

    const sourceFile = metadata.sourceFile;
    const baseName = getBaseName(metadata.name);
    const directiveName = kebabCase(baseName);
    const outputFilePath = `client/src/app/directives/${directiveName}/${directiveName}.directive.ts`;

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

    // Extract selector from @directive decorator
    let selector = '';
    const directiveDecorator = exportedClass.getDecorator('directive');
    if (directiveDecorator) {
      const decoratorArgs = directiveDecorator.getArguments();
      if (decoratorArgs.length > 0) {
        const configText = decoratorArgs[0].getText();
        const selectorMatch = configText.match(/selector:\s*["']([^"']+)["']/);
        if (selectorMatch) {
          selector = selectorMatch[1];
        }
      }
      directiveDecorator.remove();
    }
    debug('selector %j', selector);

    // Capture service imports before removing design aliases
    const serviceImports: { name: string; typeName: string }[] = [];
    const servicesImportDecls = writableFile.getImportDeclarations().filter(imp => imp.getModuleSpecifierValue() === '@services');
    for (const decl of servicesImportDecls) {
      for (const named of decl.getNamedImports()) {
        serviceImports.push({ name: named.getName(), typeName: named.getName() });
      }
    }
    debug('captured service imports %j', serviceImports);

    // Build set of all known service type names
    const serviceTypeNames = new Set(serviceImports.map(s => s.typeName));
    for (const m of context.listMetadata('Service') || []) {
      serviceTypeNames.add(m.name);
    }

    // Capture BO imports
    const boNamedImports = captureBoImports(writableFile);
    debug('captured bo imports %j', boNamedImports);

    // Capture @components imports before removing design aliases
    const componentImportNames: string[] = [];
    const componentsImportDecls = writableFile.getImportDeclarations().filter(imp => imp.getModuleSpecifierValue() === '@components');
    for (const decl of componentsImportDecls) {
      for (const named of decl.getNamedImports()) {
        componentImportNames.push(named.getName());
      }
    }
    debug('captured component imports %j', componentImportNames);

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

    // Remove extends Directive
    if (exportedClass.getExtends()) {
      exportedClass.removeExtends();
    }

    // Process @property decorators
    const { inputProperties, outputProperties } = processPropertyDecorators(exportedClass);
    debug('inputs %j, outputs %j', inputProperties, outputProperties);

    // Angular core extras to collect
    const angularCoreExtras: string[] = ['Directive'];

    // Apply @Input() to input properties
    for (const propName of inputProperties) {
      const prop = exportedClass.getProperty(propName);
      if (prop) {
        prop.addDecorator({ name: 'Input', arguments: [] });
        if (!angularCoreExtras.includes('Input')) angularCoreExtras.push('Input');
      }
    }

    // Apply @Output() to output properties
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

    // Process @method decorators — look for callOnEvent
    const hostListeners: { methodName: string; eventName: string }[] = [];
    const callOnLoadMethods: string[] = [];
    const callOnUnloadMethods: string[] = [];

    for (const meth of exportedClass.getMethods()) {
      const methodDecorator = meth.getDecorator('method');
      if (methodDecorator) {
        const args = methodDecorator.getArguments();
        if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
          const callOnEventProp = args[0].getProperty('callOnEvent');
          if (callOnEventProp && Node.isPropertyAssignment(callOnEventProp)) {
            const eventName = callOnEventProp.getInitializerOrThrow().getText().replace(/['"]/g, '');
            hostListeners.push({ methodName: meth.getName(), eventName });
            debug('host listener %j on %j', meth.getName(), eventName);
          }

          const callOnLoadProp = args[0].getProperty('callOnLoad');
          if (callOnLoadProp && Node.isPropertyAssignment(callOnLoadProp)) {
            if (callOnLoadProp.getInitializerOrThrow().getText() === 'true') {
              callOnLoadMethods.push(meth.getName());
            }
          }

          const callAfterLoadProp = args[0].getProperty('callAfterLoad');
          if (callAfterLoadProp && Node.isPropertyAssignment(callAfterLoadProp)) {
            if (callAfterLoadProp.getInitializerOrThrow().getText() === 'true') {
              callOnLoadMethods.push(meth.getName());
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

    // Add @HostListener decorators
    for (const hl of hostListeners) {
      const meth = exportedClass.getMethod(hl.methodName);
      if (meth) {
        meth.addDecorator({ name: 'HostListener', arguments: [`'${hl.eventName}'`, `['$event']`] });
        if (!angularCoreExtras.includes('HostListener')) angularCoreExtras.push('HostListener');
      }
    }

    // Convert service properties to inject()
    for (const prop of exportedClass.getProperties()) {
      if (prop.getDecorator('Input') || prop.getDecorator('Output')) continue;
      const typeNode = prop.getTypeNode();
      if (typeNode && serviceTypeNames.has(typeNode.getText())) {
        const serviceName = prop.getName();
        const serviceType = typeNode.getText();
        prop.remove();
        exportedClass.addProperty({
          name: serviceName,
          isReadonly: false,
          scope: undefined,
          initializer: `inject(${serviceType})`
        });
        if (!angularCoreExtras.includes('inject')) angularCoreExtras.push('inject');
      }
    }

    // Build set of injectable external type names (Router, HttpClient, MatDialog, etc.)
    const injectableExternalTypes = new Map<string, string>();
    for (const et of context.listMetadata('ExternalType') || []) {
      const etClass = et.sourceFile.getClasses()[0];
      if (!etClass) continue;
      const opts = getClassDecorator(etClass, 'externalType');
      if (!opts?.injectable) continue;
      for (const imp of et.sourceFile.getImportDeclarations()) {
        const moduleSpec = imp.getModuleSpecifierValue();
        if (moduleSpec.includes('@apexdesigner/dsl')) continue;
        for (const named of imp.getNamedImports()) {
          injectableExternalTypes.set(named.getName(), moduleSpec);
        }
      }
    }
    debug('injectable external types %j', Object.fromEntries(injectableExternalTypes));

    // Convert injectable external-type properties to inject() calls
    const injectedExternalTypes: { propName: string; typeName: string; moduleSpecifier: string }[] = [];
    for (const prop of exportedClass.getProperties()) {
      if (!prop.hasExclamationToken()) continue;
      if (prop.getDecorators().length > 0) continue;
      const typeNode = prop.getTypeNode();
      if (!typeNode) continue;
      const typeText = typeNode.getText();

      if (serviceTypeNames.has(typeText)) continue; // already handled above

      const moduleSpecifier = injectableExternalTypes.get(typeText);
      if (moduleSpecifier) {
        injectedExternalTypes.push({ propName: prop.getName(), typeName: typeText, moduleSpecifier });
        prop.replaceWithText(`private ${prop.getName()} = inject(${typeText})`);
        if (!angularCoreExtras.includes('inject')) angularCoreExtras.push('inject');
        debug('injected external type %j: %j from %j', prop.getName(), typeText, moduleSpecifier);
      }
    }

    // Build lifecycle hooks
    const interfaces: string[] = [];
    let ngOnInitBody = '';
    let ngOnDestroyBody = '';

    if (callOnLoadMethods.length > 0) {
      interfaces.push('OnInit');
      ngOnInitBody = callOnLoadMethods.map(m => `    this.${m}();`).join('\n');
    }
    if (callOnUnloadMethods.length > 0) {
      interfaces.push('OnDestroy');
      ngOnDestroyBody = callOnUnloadMethods.map(m => `    this.${m}();`).join('\n');
    }

    // Remove the class and rebuild as Angular directive
    const className = exportedClass.getName()!;
    const classBody = exportedClass
      .getMembers()
      .map(m => m.getText())
      .join('\n\n  ');
    const extendsClause = '';
    const implementsClause = interfaces.length > 0 ? ` implements ${interfaces.join(', ')}` : '';

    // Collect all imports
    const existingImports = writableFile
      .getImportDeclarations()
      .map(imp => imp.getText())
      .join('\n');

    // Build @Directive decorator
    let decoratorConfig = `\n  selector: '${selector}'`;
    decoratorConfig += `,\n  standalone: true`;

    // Build service imports
    const serviceImportLines: string[] = [];
    for (const svc of serviceImports) {
      const svcMetadata = (context.listMetadata('Service') || []).find(m => m.name === svc.typeName);
      if (svcMetadata) {
        const svcBaseName = svc.typeName.replace(/Service$/, '');
        const svcFile = kebabCase(svcBaseName);
        serviceImportLines.push(`import { ${svc.typeName} } from '../../services/${svcFile}/${svcFile}.service';`);
      }
    }

    // Build component imports for @components references
    const componentImportLines: string[] = [];
    const componentMetadata = context.listMetadata('Component') || [];
    for (const compName of componentImportNames) {
      const compMeta = componentMetadata.find(m => m.name === compName);
      if (compMeta) {
        const compBaseName = compName.replace(/Component$/, '');
        const compFile = kebabCase(compBaseName);
        const isDialog = getClassDecorator(getClassByBase(compMeta.sourceFile, 'Component'), 'component');
        const dialogConfig = isDialog ? JSON.stringify(isDialog) : '';
        const isDialogComponent = dialogConfig.includes('isDialog');
        componentImportLines.push(`import { ${compName} } from '../../components/${compFile}/${compFile}.component';`);
      }
    }

    // Build injectable external type imports
    const externalImportLines: string[] = [];
    for (const { typeName, moduleSpecifier } of injectedExternalTypes) {
      externalImportLines.push(`import { ${typeName} } from '${moduleSpecifier}';`);
    }

    // Add BO imports
    const boImportLine = addBoImports(writableFile, boNamedImports, outputFilePath);

    // Build ngOnInit and ngOnDestroy
    let lifecycleMethods = '';
    if (ngOnInitBody) {
      lifecycleMethods += `\n\n  ngOnInit(): void {\n${ngOnInitBody}\n  }`;
      angularCoreExtras.push('OnInit');
    }
    if (ngOnDestroyBody) {
      lifecycleMethods += `\n\n  ngOnDestroy(): void {\n${ngOnDestroyBody}\n  }`;
      angularCoreExtras.push('OnDestroy');
    }

    // Deduplicate angular core extras
    const uniqueExtras = [...new Set(angularCoreExtras)].sort();

    // Build final output
    let output = `import { ${uniqueExtras.join(', ')} } from '@angular/core';\n`;

    // Build set of module specifiers already handled by injectable external types
    const handledModuleSpecs = new Set(injectedExternalTypes.map(t => t.moduleSpecifier));

    // Add remaining non-design imports from the source
    for (const imp of writableFile.getImportDeclarations()) {
      const moduleSpec = imp.getModuleSpecifierValue();
      if (moduleSpec === '@angular/core') continue;
      if (handledModuleSpecs.has(moduleSpec)) continue;
      output += imp.getText() + '\n';
    }

    // Add resolved imports
    if (boImportLine) output += boImportLine + '\n';
    for (const line of serviceImportLines) output += line + '\n';
    for (const line of componentImportLines) output += line + '\n';
    for (const line of externalImportLines) output += line + '\n';

    // Build class with decorator
    const jsDoc = exportedClass
      .getJsDocs()
      .map(d => d.getText())
      .join('\n');
    if (jsDoc) output += '\n' + jsDoc;

    output += `\n@Directive({${decoratorConfig}\n})`;
    output += `\nexport class ${className}${implementsClause} {`;
    output += `\n  ${classBody}`;
    output += lifecycleMethods;
    output += `\n}\n`;

    const results = new Map<string, string>();
    results.set(outputFilePath, output);

    debug('generated %j (%d chars)', outputFilePath, output.length);
    return results;
  }
};

export { directiveGenerator };
