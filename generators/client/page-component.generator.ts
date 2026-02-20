import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { getClassByBase, getModuleLevelCall, getTemplateString, getClassDecorator } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import { Node, Project, QuoteKind, SyntaxKind } from 'ts-morph';
import createDebug from 'debug';
import { getTemplateImports, convertAd3Template } from './shared.js';

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

    // Capture @business-objects imports before removing design aliases
    const boNamedImports: string[] = [];
    const boImportDecl = writableFile.getImportDeclaration(
      (imp) => imp.getModuleSpecifierValue() === '@business-objects'
    );
    if (boImportDecl) {
      for (const named of boImportDecl.getNamedImports()) {
        boNamedImports.push(named.getName());
      }
      debug('captured @business-objects imports %j', boNamedImports);
    }

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

    // Process @property decorators — collect auto-read properties, form group properties, onChangeCall mappings, and remove decorators
    interface AutoReadProperty {
      name: string;
      typeName: string;
      isArray: boolean;
    }
    interface FormGroupProperty {
      name: string;
      typeName: string;
      readMode?: string;
      saveMode?: string;
      include?: string;
      afterReadCall?: string;
    }
    interface PersistedArrayProperty {
      name: string;
      typeName: string;
      readMode?: string;
      order?: string;
    }
    const autoReadProperties: AutoReadProperty[] = [];
    const formGroupProperties: FormGroupProperty[] = [];
    const persistedArrayProperties: PersistedArrayProperty[] = [];
    const onChangeCallMap = new Map<string, string>(); // propertyName → methodName

    for (const prop of exportedClass.getProperties()) {
      const propertyDecorator = prop.getDecorator('property');
      if (!propertyDecorator) continue;

      // Parse decorator options
      const args = propertyDecorator.getArguments();
      let readMode: string | undefined;
      let saveMode: string | undefined;
      let onChangeCall: string | undefined;
      let afterReadCall: string | undefined;
      if (args.length > 0) {
        const argText = args[0].getText();
        const readMatch = argText.match(/read:\s*["']([^"']+)["']/);
        if (readMatch) readMode = readMatch[1];
        const saveMatch = argText.match(/save:\s*["']([^"']+)["']/);
        if (saveMatch) saveMode = saveMatch[1];
        const onChangeMatch = argText.match(/onChangeCall:\s*["']([^"']+)["']/);
        if (onChangeMatch) onChangeCall = onChangeMatch[1];
        const afterReadMatch = argText.match(/afterReadCall:\s*["']([^"']+)["']/);
        if (afterReadMatch) afterReadCall = afterReadMatch[1];
      }

      // Parse include and order options using AST (object/array values, not simple strings)
      let include: string | undefined;
      let order: string | undefined;
      if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
        const includeProp = args[0].getProperty('include');
        if (includeProp && Node.isPropertyAssignment(includeProp)) {
          include = includeProp.getInitializerOrThrow().getText();
        }
        const orderProp = args[0].getProperty('order');
        if (orderProp && Node.isPropertyAssignment(orderProp)) {
          order = orderProp.getInitializerOrThrow().getText();
        }
      }

      // Get property type info
      const typeNode = prop.getTypeNode();
      const typeText = typeNode?.getText() || '';
      const isArray = typeText.endsWith('[]');
      const typeName = isArray ? typeText.slice(0, -2) : typeText;

      // Detect FormGroup types (e.g. SupplierFormGroup)
      if (typeName.endsWith('FormGroup')) {
        formGroupProperties.push({ name: prop.getName(), typeName, readMode, saveMode, include, afterReadCall });
        debug('form group property %j: %j (read: %j, save: %j, afterReadCall: %j)', prop.getName(), typeName, readMode, saveMode, afterReadCall);
      } else if (typeName.endsWith('PersistedArray')) {
        persistedArrayProperties.push({ name: prop.getName(), typeName, readMode, order });
        debug('persisted array property %j: %j (read: %j, order: %j)', prop.getName(), typeName, readMode, order);
      } else if (readMode === 'Automatically') {
        autoReadProperties.push({ name: prop.getName(), typeName, isArray });
        debug('auto-read property %j: %j (array: %j)', prop.getName(), typeName, isArray);
      }

      if (onChangeCall) {
        onChangeCallMap.set(prop.getName(), onChangeCall);
        debug('onChangeCall %j → %j', prop.getName(), onChangeCall);
      }

      // Remove the @property decorator
      propertyDecorator.remove();
    }

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
    for (const [propName, methodName] of onChangeCallMap) {
      const prop = exportedClass.getProperty(propName);
      if (!prop) continue;

      const typeText = prop.getTypeNode()?.getText() || 'any';
      const hasExclamation = prop.hasExclamationToken();
      const propIndex = exportedClass.getMembers().indexOf(prop);

      // Remove the original property
      prop.remove();

      // Insert backing field + getter + setter at the same position
      const backingField = `private _${propName}${hasExclamation ? '!' : ''}: ${typeText};`;
      const getter = `get ${propName}(): ${typeText} { return this._${propName}; }`;
      const setter = `set ${propName}(value: ${typeText}) { this._${propName} = value; this.${methodName}(); }`;

      exportedClass.insertMember(propIndex, `\n${backingField}\n  ${getter}\n  ${setter}`);
      debug('transformed %j to getter/setter calling %j', propName, methodName);
    }

    // Process @method decorators — collect callOnLoad methods and remove decorators
    const callOnLoadMethods: string[] = [];

    for (const classMethod of exportedClass.getMethods()) {
      const methodDecorator = classMethod.getDecorator('method');
      if (!methodDecorator) continue;

      const args = methodDecorator.getArguments();
      let callOnLoad = false;
      if (args.length > 0) {
        const argText = args[0].getText();
        callOnLoad = argText.includes('callOnLoad: true') || argText.includes('callOnLoad:true');
      }

      if (callOnLoad) {
        callOnLoadMethods.push(classMethod.getName());
        debug('callOnLoad method %j', classMethod.getName());
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

    // Add Angular imports
    const hasRouteParams = routeParams.length > 0;
    const hasAutoSaveFormGroups = formGroupProperties.some(fg => fg.saveMode === 'Automatically');
    const hasPersistedArrayAutoRead = persistedArrayProperties.some(pa => pa.readMode === 'Automatically');
    const needsOnInit = autoReadProperties.length > 0 || callOnLoadMethods.length > 0 || hasRouteParams || hasAutoSaveFormGroups || hasPersistedArrayAutoRead;
    const needsInject = hasRouteParams || hasAutoSaveFormGroups;
    const angularCoreImports = ['Component'];
    if (needsOnInit) {
      angularCoreImports.push('OnInit');
    }
    if (hasRouteParams) {
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
      writableFile.addImportDeclaration({
        moduleSpecifier: '@angular/router',
        namedImports: ['ActivatedRoute'],
      });
      writableFile.addImportDeclaration({
        moduleSpecifier: 'rxjs',
        namedImports: ['Subscription'],
      });
    }

    // Add business object imports (from design @business-objects + auto-read properties)
    const boImports = new Set<string>();
    for (const name of boNamedImports) {
      boImports.add(name);
    }
    for (const prop of autoReadProperties) {
      boImports.add(prop.typeName);
    }
    for (const boName of Array.from(boImports).sort()) {
      // Derive file name: SupplierFormGroup → supplier-form-group, SupplierPersistedArray → supplier-form-group
      let fileName: string;
      if (boName.endsWith('PersistedArray')) {
        const baseName = boName.replace(/PersistedArray$/, '');
        fileName = `${kebabCase(baseName)}-form-group`;
      } else {
        fileName = kebabCase(boName);
      }
      writableFile.addImportDeclaration({
        moduleSpecifier: `../../business-objects/${fileName}`,
        namedImports: [boName],
      });
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
        exportedClass.addMember(`\nngOnDestroy() {\n    this._routeParamsSubscription?.unsubscribe();\n  }`);
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
