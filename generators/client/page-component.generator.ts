import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassByBase, getModuleLevelCall, getTemplateString, getClassDecorator } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import { Node, Project, QuoteKind, SyntaxKind } from 'ts-morph';
import createDebug from 'debug';
import { getTemplateImports, convertAd3Template } from '@apexdesigner/generator';
import { captureBoImports, processPropertyDecorators, transformOnChangeProperties, addBoImports } from './property-processing.js';
import type { AutoReadProperty, FormGroupProperty, PersistedArrayProperty } from './property-processing.js';

const Debug = createDebug('ad3:generators:pageComponent');

/** Strip 'Page' suffix to get the base name */
function getBaseName(name: string): string {
  return name.replace(/Page$/, '');
}

const pageComponentGenerator: DesignGenerator = {
  name: 'page-component',

  triggers: [
    {
      metadataType: 'Page',
    },
  ],

  outputs: (metadata: DesignMetadata) => {
    const baseName = getBaseName(metadata.name);
    const componentName = kebabCase(baseName);
    return [
      `client/src/app/pages/${componentName}/${componentName}.page.ts`,
      `client/src/app/pages/${componentName}/${componentName}.page.html`,
      `client/src/app/pages/${componentName}/${componentName}.page.scss`,
    ];
  },

  async generate(metadata: DesignMetadata, context: GenerationContext): Promise<Map<string, string>> {
    const debug = Debug.extend('generate');
    debug('generating page component for %j', metadata.name);

    const sourceFile = metadata.sourceFile;
    const baseName = getBaseName(metadata.name);
    const componentName = kebabCase(baseName);
    const className = `${baseName}Page`;

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

    const outputFilePath = `client/src/app/pages/${componentName}/${componentName}.page.ts`;

    // Convert AD3 template syntax to Angular control flow
    const convertedTemplate = convertAd3Template(template);

    // Get template imports (resolve element/directive/pipe usage against extracted interfaces)
    const templateImports = await getTemplateImports(exportedClass, context, 'page', outputFilePath, template);
    debug('template requires %j import groups', templateImports.length);

    // Capture @business-objects / @business-objects-client imports before removing design aliases
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
    for (const m of (context.listMetadata('Service') || [])) {
      serviceTypeNames.add(m.name);
    }

    // Build set of injectable external type names (e.g. Router, HttpClient, MatDialog)
    // and map each to its module specifier (e.g. Router → @angular/router)
    const injectableExternalTypes = new Map<string, string>();
    for (const et of (context.listMetadata('ExternalType') || [])) {
      const etClass = et.sourceFile.getClasses()[0];
      if (!etClass) continue;
      const opts = getClassDecorator(etClass, 'externalType');
      if (!opts?.injectable) continue;
      // The real type + module come from the non-DSL import
      for (const imp of et.sourceFile.getImportDeclarations()) {
        const moduleSpec = imp.getModuleSpecifierValue();
        if (moduleSpec.includes('@apexdesigner/dsl')) continue;
        for (const named of imp.getNamedImports()) {
          injectableExternalTypes.set(named.getName(), moduleSpec);
        }
      }
    }
    debug('injectable external types %j', Object.fromEntries(injectableExternalTypes));

    // Remove DSL and design-time alias imports
    // Design aliases are single-segment (@pages, @base-types, etc.)
    // npm scoped packages have a slash (@angular/core, @apexdesigner/dsl)
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

    // Process @property decorators
    const { autoReadProperties, formGroupProperties, persistedArrayProperties, onChangeCallMap } =
      processPropertyDecorators(exportedClass);
    debug('autoRead %j, formGroups %j, persistedArrays %j', autoReadProperties.length, formGroupProperties.length, persistedArrayProperties.length);

    // Extract route params from @page path before transforming properties
    // Supports :propName (simple) and :prop.field (dotted — e.g. :supplier.id)
    interface RouteParam {
      paramName: string;       // Angular route param name (e.g. 'supplierId')
      propertyName: string;    // page property (e.g. 'supplier' or 'supplierId')
      field?: string;          // sub-field for dotted params (e.g. 'id')
    }
    const routeParams: RouteParam[] = [];
    const pageDecorator = exportedClass.getDecorator('page');
    if (pageDecorator) {
      const pageArgs = pageDecorator.getArguments();
      if (pageArgs.length > 0) {
        const argText = pageArgs[0].getText();
        const pathMatch = argText.match(/path:\s*["']([^"']+)["']/);
        if (pathMatch) {
          const propertyNames = new Set(exportedClass.getProperties().map(p => p.getName()));
          // Match :word or :word.word patterns
          for (const match of pathMatch[1].matchAll(/:(\w+)(?:\.(\w+))?/g)) {
            const first = match[1];
            const second = match[2];
            if (second) {
              // Dotted param: :supplier.id → paramName='supplierId', propertyName='supplier', field='id'
              const paramName = `${first}${second.charAt(0).toUpperCase()}${second.slice(1)}`;
              routeParams.push({ paramName, propertyName: first, field: second });
            } else if (propertyNames.has(first)) {
              // Simple param: :supplierId → paramName='supplierId', propertyName='supplierId'
              routeParams.push({ paramName: first, propertyName: first });
            }
          }
          debug('route params %j', routeParams);
        }
      }
      pageDecorator.remove();
    }

    // Transform onChangeCall properties into getter/setter with private backing field
    transformOnChangeProperties(exportedClass, onChangeCallMap);

    // Detect properties typed as component classes and convert to @ViewChild
    const componentNames = new Set((context.listMetadata('Component') || []).map(m => m.name));
    const viewChildProps: { name: string; typeName: string; componentFile: string }[] = [];

    for (const prop of exportedClass.getProperties()) {
      // Skip properties that already have decorators
      if (prop.getDecorators().length > 0) continue;

      const typeNode = prop.getTypeNode();
      if (!typeNode) continue;
      const typeText = typeNode.getText();
      if (componentNames.has(typeText)) {
        const childBaseName = typeText.replace(/Component$/, '');
        const childFile = kebabCase(childBaseName);
        viewChildProps.push({ name: prop.getName(), typeName: typeText, componentFile: childFile });
        debug('viewChild property %j: %j', prop.getName(), typeText);

        prop.addDecorator({ name: 'ViewChild', arguments: [`'${prop.getName()}'`] });
      }
    }

    // Process @method decorators — collect callOnLoad/callAfterLoad/callOnUnload methods and remove decorators
    const callOnLoadMethods: string[] = [];
    const callAfterLoadMethods: string[] = [];
    const callOnUnloadMethods: string[] = [];

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
        if (argText.includes('callAfterLoad: true') || argText.includes('callAfterLoad:true')) {
          callAfterLoadMethods.push(classMethod.getName());
          debug('callAfterLoad method %j', classMethod.getName());
        }
        if (argText.includes('callOnUnload: true') || argText.includes('callOnUnload:true')) {
          callOnUnloadMethods.push(classMethod.getName());
          debug('callOnUnload method %j', classMethod.getName());
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

    // Remove extends Page
    if (exportedClass.getExtends()) {
      exportedClass.removeExtends();
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
        prop.replaceWithText(`${propName} = inject(${typeText})`);
        debug('injected service %j: %j', propName, typeText);
      }
    }

    // Convert injectable external-type properties (Router, HttpClient, MatDialog, etc.) to inject() calls
    const injectedExternalTypes: { propName: string; typeName: string; moduleSpecifier: string }[] = [];
    for (const prop of exportedClass.getProperties()) {
      if (!prop.hasExclamationToken()) continue;
      if (prop.getDecorators().length > 0) continue;
      const typeNode = prop.getTypeNode();
      if (!typeNode) continue;
      const typeText = typeNode.getText();

      const moduleSpecifier = injectableExternalTypes.get(typeText);
      if (moduleSpecifier) {
        const propName = prop.getName();
        injectedExternalTypes.push({ propName, typeName: typeText, moduleSpecifier });
        prop.replaceWithText(`private ${propName} = inject(${typeText})`);
        debug('injected external type %j: %j from %j', propName, typeText, moduleSpecifier);
      }
    }

    // Add Angular imports
    const hasRouteParams = routeParams.length > 0;
    const hasAutoSaveFormGroups = formGroupProperties.some(fg => fg.saveMode === 'Automatically');
    const hasPersistedArrayAutoRead = persistedArrayProperties.some(pa => pa.readMode === 'Automatically');
    const needsOnInit = autoReadProperties.length > 0 || callOnLoadMethods.length > 0 || hasRouteParams || hasAutoSaveFormGroups || hasPersistedArrayAutoRead;
    const needsInject = hasRouteParams || hasAutoSaveFormGroups || injectedServices.length > 0 || injectedExternalTypes.length > 0;
    const angularCoreImports = ['Component'];
    if (viewChildProps.length > 0) {
      angularCoreImports.push('ViewChild');
    }
    if (needsOnInit) {
      angularCoreImports.push('OnInit');
    }
    if (callAfterLoadMethods.length > 0) {
      angularCoreImports.push('AfterViewInit');
    }
    if (hasRouteParams || callOnUnloadMethods.length > 0) {
      angularCoreImports.push('OnDestroy');
    }
    if (needsInject) {
      angularCoreImports.push('inject');
    }
    if (hasAutoSaveFormGroups) {
      angularCoreImports.push('DestroyRef');
    }
    writableFile.insertImportDeclaration(0, {
      moduleSpecifier: '@angular/core',
      namedImports: angularCoreImports,
    });

    if (hasRouteParams) {
      const existingRouterImport = writableFile.getImportDeclaration(
        (imp) => imp.getModuleSpecifierValue() === '@angular/router'
      );
      if (existingRouterImport) {
        const existingNames = existingRouterImport.getNamedImports().map(ni => ni.getName());
        if (!existingNames.includes('ActivatedRoute')) {
          existingRouterImport.addNamedImport('ActivatedRoute');
        }
      } else {
        writableFile.addImportDeclaration({
          moduleSpecifier: '@angular/router',
          namedImports: ['ActivatedRoute'],
        });
      }
      writableFile.addImportDeclaration({
        moduleSpecifier: 'rxjs',
        namedImports: ['Subscription'],
      });
    }

    // Add business object imports (from design @business-objects + auto-read + persisted array types)
    const boImports = new Set<string>();
    for (const name of boNamedImports) boImports.add(name);
    for (const prop of autoReadProperties) boImports.add(prop.typeName);
    for (const pa of persistedArrayProperties) boImports.add(pa.typeName);
    for (const fg of formGroupProperties) boImports.add(fg.typeName);
    addBoImports(writableFile, boImports, '../../business-objects');

    // Initialize form group properties with new instances
    for (const fg of formGroupProperties) {
      const prop = exportedClass.getProperty(fg.name);
      if (!prop) continue;
      if (prop.hasQuestionToken()) prop.setHasQuestionToken(false);
      if (prop.hasExclamationToken()) prop.setHasExclamationToken(false);
      const optsParts: string[] = [];
      if (fg.required) optsParts.push(`required: ${fg.required}`);
      if (fg.disabled) optsParts.push(`disabled: ${fg.disabled}`);
      if (optsParts.length > 0) {
        prop.setInitializer(`new ${fg.typeName}({ ${optsParts.join(', ')} })`);
      } else {
        prop.setInitializer(`new ${fg.typeName}()`);
      }
    }

    // Initialize persisted array properties with new instances
    for (const pa of persistedArrayProperties) {
      const prop = exportedClass.getProperty(pa.name);
      if (!prop) continue;
      if (prop.hasQuestionToken()) prop.setHasQuestionToken(false);
      if (prop.hasExclamationToken()) prop.setHasExclamationToken(false);
      prop.setInitializer(`new ${pa.typeName}()`);
    }

    // Add OnInit/OnDestroy implementation and lifecycle methods
    if (needsOnInit) {
      exportedClass.addImplements('OnInit');

      // Find insertion point: after properties, before design methods
      const members = exportedClass.getMembers();
      let insertIndex = members.length;
      for (let i = 0; i < members.length; i++) {
        if (members[i].getKind() === SyntaxKind.MethodDeclaration) {
          insertIndex = i;
          break;
        }
      }

      if (hasRouteParams) {
        exportedClass.addImplements('OnDestroy');

        // Build subscription body lines
        const subscriptionLines: string[] = [];
        for (const param of routeParams) {
          const linkedFormGroup = formGroupProperties.find(fg => fg.name === param.propertyName);
          if (linkedFormGroup && param.field && linkedFormGroup.readMode === 'Automatically') {
            // Dotted param linked to form group: auto-read with filter
            const filterParts = [`where: { ${param.field}: params['${param.paramName}'] }`];
            if (linkedFormGroup.include) {
              filterParts.push(`include: ${linkedFormGroup.include}`);
            }
            subscriptionLines.push(`await this.${param.propertyName}.read({ ${filterParts.join(', ')} });`);
            if (linkedFormGroup.afterReadCall) {
              subscriptionLines.push(`this.${linkedFormGroup.afterReadCall}();`);
            }
          } else if (!param.field) {
            // Simple param: direct assignment
            subscriptionLines.push(`this.${param.propertyName} = params['${param.paramName}'];`);
          }
        }

        // Lines before subscription: auto-save wiring for form groups
        const preSubscriptionLines: string[] = [];
        for (const fg of formGroupProperties) {
          if (fg.saveMode === 'Automatically') {
            preSubscriptionLines.push(`this.${fg.name}.autoSave(this.destroyRef);`);
          }
        }

        // Lines after subscription: non-route auto-reads + persisted arrays + callOnLoad
        const postSubscriptionLines: string[] = [];
        for (const prop of autoReadProperties) {
          if (prop.isArray) {
            postSubscriptionLines.push(`this.${prop.name} = await ${prop.typeName}.find();`);
          } else {
            postSubscriptionLines.push(`// TODO: load ${prop.name} by route parameter`);
          }
        }
        for (const pa of persistedArrayProperties) {
          if (pa.readMode === 'Automatically') {
            const readArg = pa.order ? `{ order: ${pa.order} }` : '';
            postSubscriptionLines.push(`await this.${pa.name}.read(${readArg});`);
            if (pa.afterReadCall) postSubscriptionLines.push(`this.${pa.afterReadCall}();`);
          }
        }
        for (const methodName of callOnLoadMethods) {
          postSubscriptionLines.push(`this.${methodName}();`);
        }

        const subscriptionBody = subscriptionLines.map(l => `      ${l}`).join('\n');
        const initLines = [
          '',
          `private route = inject(ActivatedRoute);`,
        ];
        if (hasAutoSaveFormGroups) {
          initLines.push(`private destroyRef = inject(DestroyRef);`);
        }
        initLines.push(`private _routeParamsSubscription!: Subscription;`);
        initLines.push('');
        initLines.push(`ngOnInit() {`);
        for (const line of preSubscriptionLines) {
          initLines.push(`  ${line}`);
        }
        initLines.push(`  this._routeParamsSubscription = this.route.params.subscribe(async (params) => {`);
        initLines.push(subscriptionBody);
        initLines.push(`  });`);
        if (postSubscriptionLines.length > 0) {
          const afterSubscription = postSubscriptionLines.map(l => `  ${l}`).join('\n  ');
          initLines.push(afterSubscription);
        }
        initLines.push(`}`);

        exportedClass.insertMember(insertIndex, initLines.join('\n  '));

        // Add ngOnDestroy as the last method
        const onDestroyLines = [`this._routeParamsSubscription?.unsubscribe();`];
        for (const methodName of callOnUnloadMethods) {
          onDestroyLines.push(`this.${methodName}();`);
        }
        exportedClass.addMember(`\nngOnDestroy() {\n    ${onDestroyLines.join('\n    ')}\n  }`);
      } else {
        // No route params: everything goes in ngOnInit directly
        const coreInitLines: string[] = [];
        // Auto-save wiring for form groups
        for (const fg of formGroupProperties) {
          if (fg.saveMode === 'Automatically') {
            coreInitLines.push(`this.${fg.name}.autoSave(this.destroyRef);`);
          }
        }
        for (const prop of autoReadProperties) {
          if (prop.isArray) {
            coreInitLines.push(`this.${prop.name} = await ${prop.typeName}.find();`);
          } else {
            coreInitLines.push(`// TODO: load ${prop.name} by route parameter`);
          }
        }
        for (const pa of persistedArrayProperties) {
          if (pa.readMode === 'Automatically') {
            const readArg = pa.order ? `{ order: ${pa.order} }` : '';
            coreInitLines.push(`await this.${pa.name}.read(${readArg});`);
            if (pa.afterReadCall) coreInitLines.push(`this.${pa.afterReadCall}();`);
          }
        }
        for (const methodName of callOnLoadMethods) {
          coreInitLines.push(`this.${methodName}();`);
        }

        // Add DestroyRef injection if needed
        const elseInitLines: string[] = [];
        if (hasAutoSaveFormGroups) {
          elseInitLines.push('');
          elseInitLines.push(`private destroyRef = inject(DestroyRef);`);
          elseInitLines.push('');
        }
        const initBody = coreInitLines.join('\n    ');
        const asyncPrefix = (autoReadProperties.length > 0 || hasPersistedArrayAutoRead) ? 'async ' : '';
        elseInitLines.push(`${asyncPrefix}ngOnInit() {\n    ${initBody}\n  }`);
        exportedClass.insertMember(insertIndex, elseInitLines.join('\n  '));
      }
    }

    // Add ngAfterViewInit for callAfterLoad methods
    if (callAfterLoadMethods.length > 0) {
      exportedClass.addImplements('AfterViewInit');
      const afterViewInitBody = callAfterLoadMethods.map(m => `this.${m}();`).join('\n    ');
      exportedClass.addMember(`\nngAfterViewInit() {\n    ${afterViewInitBody}\n  }`);
    }

    // Add ngOnDestroy for callOnUnload methods (no route-params case)
    if (callOnUnloadMethods.length > 0 && !hasRouteParams) {
      exportedClass.addImplements('OnDestroy');
      const onDestroyBody = callOnUnloadMethods.map(m => `this.${m}();`).join('\n    ');
      exportedClass.addMember(`\nngOnDestroy() {\n    ${onDestroyBody}\n  }`);
    }

    // Add template-based imports (file-level)
    for (const templateImport of templateImports) {
      const existingImport = writableFile.getImportDeclaration(
        (imp) => imp.getModuleSpecifierValue() === templateImport.moduleSpecifier
      );

      if (!existingImport) {
        writableFile.addImportDeclaration({
          moduleSpecifier: templateImport.moduleSpecifier,
          namedImports: templateImport.namedImports,
        });
      } else {
        const existingNamedImports = existingImport.getNamedImports().map(ni => ni.getName());
        templateImport.namedImports.forEach((importName) => {
          if (!existingNamedImports.includes(importName)) {
            existingImport.addNamedImport(importName);
          }
        });
      }
    }

    // Add imports for ViewChild component types (after template imports to avoid duplicates)
    for (const vc of viewChildProps) {
      const alreadyImported = writableFile.getImportDeclarations().some(imp =>
        imp.getNamedImports().some(ni => ni.getName() === vc.typeName)
      );
      if (!alreadyImported) {
        writableFile.addImportDeclaration({
          moduleSpecifier: `../../components/${vc.componentFile}/${vc.componentFile}.component`,
          namedImports: [vc.typeName],
        });
      }
    }

    // Add service imports (re-map @services -> relative paths)
    for (const svc of injectedServices) {
      writableFile.addImportDeclaration({
        moduleSpecifier: `../../services/${svc.serviceFile}/${svc.serviceFile}.service`,
        namedImports: [svc.typeName],
      });
    }

    // Build imports array for @Component decorator
    const componentImports: string[] = [];
    templateImports.forEach((imp) => {
      componentImports.push(...imp.namedImports);
    });
    componentImports.sort((a, b) => a.localeCompare(b));

    // Build @Component decorator config
    let decoratorConfig = `{\n  selector: '${componentName}',\n  templateUrl: './${componentName}.page.html',\n  styleUrls: ['./${componentName}.page.scss']`;

    if (componentImports.length > 0) {
      decoratorConfig += `,\n  imports: [${componentImports.join(', ')}]`;
    }

    decoratorConfig += `\n}`;

    exportedClass.addDecorator({
      name: 'Component',
      arguments: [decoratorConfig],
    });

    // Build output files
    const outputs = new Map<string, string>();
    outputs.set(`client/src/app/pages/${componentName}/${componentName}.page.ts`, writableFile.getText());
    outputs.set(`client/src/app/pages/${componentName}/${componentName}.page.html`, convertedTemplate.trim());
    outputs.set(`client/src/app/pages/${componentName}/${componentName}.page.scss`, styles);

    return outputs;
  },
};

export { pageComponentGenerator };
