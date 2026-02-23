import { Node, type ClassDeclaration, type SourceFile } from 'ts-morph';
import { kebabCase } from 'change-case';

export interface AutoReadProperty {
  name: string;
  typeName: string;
  isArray: boolean;
}

export interface FormGroupProperty {
  name: string;
  typeName: string;
  readMode?: string;
  saveMode?: string;
  include?: string;
  afterReadCall?: string;
}

export interface PersistedArrayProperty {
  name: string;
  typeName: string;
  readMode?: string;
  order?: string;
}

export interface ProcessedProperties {
  autoReadProperties: AutoReadProperty[];
  formGroupProperties: FormGroupProperty[];
  persistedArrayProperties: PersistedArrayProperty[];
  onChangeCallMap: Map<string, string>;
  inputProperties: string[];
  outputProperties: string[];
}

/**
 * Captures named imports from @business-objects / @business-objects-client design aliases.
 * Call BEFORE removing design imports.
 */
export function captureBoImports(writableFile: SourceFile): string[] {
  const boNamedImports: string[] = [];
  for (const alias of ['@business-objects', '@business-objects-client']) {
    const boImportDecl = writableFile.getImportDeclaration(
      (imp) => imp.getModuleSpecifierValue() === alias
    );
    if (boImportDecl) {
      for (const named of boImportDecl.getNamedImports()) {
        boNamedImports.push(named.getName());
      }
    }
  }
  return boNamedImports;
}

/**
 * Adds re-mapped business object imports to the writableFile.
 * SupplierFormArray → relativePath/supplier-form-array
 */
export function addBoImports(writableFile: SourceFile, boImports: Set<string>, relativePath: string): void {
  for (const boName of Array.from(boImports).sort()) {
    writableFile.addImportDeclaration({
      moduleSpecifier: `${relativePath}/${kebabCase(boName)}`,
      namedImports: [boName],
    });
  }
}

/**
 * Processes @property decorators on the exported class.
 * Removes @property decorators. Does NOT apply @Input/@Output — callers handle that.
 */
export function processPropertyDecorators(exportedClass: ClassDeclaration): ProcessedProperties {
  const autoReadProperties: AutoReadProperty[] = [];
  const formGroupProperties: FormGroupProperty[] = [];
  const persistedArrayProperties: PersistedArrayProperty[] = [];
  const onChangeCallMap = new Map<string, string>();
  const inputProperties: string[] = [];
  const outputProperties: string[] = [];

  for (const prop of exportedClass.getProperties()) {
    const propertyDecorator = prop.getDecorator('property');
    if (!propertyDecorator) continue;

    const args = propertyDecorator.getArguments();
    let readMode: string | undefined;
    let saveMode: string | undefined;
    let onChangeCall: string | undefined;
    let afterReadCall: string | undefined;
    let isInput = false;
    let isOutput = false;

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
      const isInputProp = args[0].getProperty('isInput');
      if (isInputProp && Node.isPropertyAssignment(isInputProp)) {
        isInput = isInputProp.getInitializerOrThrow().getText() === 'true';
      }
      const isOutputProp = args[0].getProperty('isOutput');
      if (isOutputProp && Node.isPropertyAssignment(isOutputProp)) {
        isOutput = isOutputProp.getInitializerOrThrow().getText() === 'true';
      }
    }

    const typeNode = prop.getTypeNode();
    const typeText = typeNode?.getText() || '';
    const isArray = typeText.endsWith('[]');
    const typeName = isArray ? typeText.slice(0, -2) : typeText;

    if (isInput) {
      inputProperties.push(prop.getName());
    } else if (isOutput) {
      outputProperties.push(prop.getName());
    } else if (typeName.endsWith('FormGroup')) {
      formGroupProperties.push({ name: prop.getName(), typeName, readMode, saveMode, include, afterReadCall });
    } else if (typeName.endsWith('PersistedArray') || typeName.endsWith('FormArray')) {
      persistedArrayProperties.push({ name: prop.getName(), typeName, readMode, order });
    } else if (readMode === 'Automatically') {
      autoReadProperties.push({ name: prop.getName(), typeName, isArray });
    }

    if (onChangeCall) {
      onChangeCallMap.set(prop.getName(), onChangeCall);
    }

    propertyDecorator.remove();
  }

  return { autoReadProperties, formGroupProperties, persistedArrayProperties, onChangeCallMap, inputProperties, outputProperties };
}

/**
 * Transforms properties with onChangeCall into private backing field + getter + setter.
 */
export function transformOnChangeProperties(
  exportedClass: ClassDeclaration,
  onChangeCallMap: Map<string, string>,
): void {
  for (const [propName, methodName] of onChangeCallMap) {
    const prop = exportedClass.getProperty(propName);
    if (!prop) continue;

    const typeText = prop.getTypeNode()?.getText() || 'any';
    const hasExclamation = prop.hasExclamationToken();
    const propIndex = exportedClass.getMembers().indexOf(prop);

    prop.remove();

    const backingField = `private _${propName}${hasExclamation ? '!' : ''}: ${typeText};`;
    const getter = `get ${propName}(): ${typeText} { return this._${propName}; }`;
    const setter = `set ${propName}(value: ${typeText}) { this._${propName} = value; this.${methodName}(); }`;

    exportedClass.insertMember(propIndex, `\n${backingField}\n  ${getter}\n  ${setter}`);
  }
}
