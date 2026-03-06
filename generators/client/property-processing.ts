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
  required?: string;
  disabled?: string;
}

export interface PersistedArrayProperty {
  name: string;
  typeName: string;
  readMode?: string;
  where?: string;
  include?: string;
  order?: string;
  fields?: string;
  omit?: string;
  limit?: string;
  offset?: string;
  afterReadCall?: string;
}

/** Keys on PersistedArrayProperty that map to .read() filter options. */
const persistedArrayReadOptionKeys = ['where', 'include', 'order', 'fields', 'omit', 'limit', 'offset'] as const;

/**
 * Builds the argument string for a PersistedArray .read() call from its options.
 * Returns '' if no options are set.
 */
export function buildReadArgs(pa: PersistedArrayProperty, indent = '      '): string {
  const parts: string[] = [];
  for (const key of persistedArrayReadOptionKeys) {
    if (pa[key]) parts.push(`${key}: ${pa[key]}`);
  }
  if (parts.length === 0) return '';
  return `{\n${indent}${parts.join(',\n' + indent)},\n${indent.slice(2)}}`;
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
    const boImportDecls = writableFile.getImportDeclarations().filter(imp => imp.getModuleSpecifierValue() === alias);
    for (const boImportDecl of boImportDecls) {
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
// Base types that all live in persisted-form-group.ts, not their own files
const PERSISTED_BASE_TYPES = new Set(['PersistedFormGroup', 'PersistedFormArray', 'PersistedArray']);

export function addBoImports(writableFile: SourceFile, boImports: Set<string>, relativePath: string): void {
  // Group persisted base types into a single import
  const persistedBaseImports: string[] = [];
  const otherImports: string[] = [];
  for (const boName of Array.from(boImports).sort()) {
    if (PERSISTED_BASE_TYPES.has(boName)) {
      persistedBaseImports.push(boName);
    } else {
      otherImports.push(boName);
    }
  }

  if (persistedBaseImports.length > 0) {
    writableFile.addImportDeclaration({
      moduleSpecifier: `${relativePath}/persisted-form-group`,
      namedImports: persistedBaseImports
    });
  }

  // Group non-base BO types by their form-group file
  const byFormGroup = new Map<string, string[]>();
  for (const boName of otherImports) {
    // Strip class suffix to get the BO name, then derive the form-group path
    const boBase = boName.replace(/(FormGroup|FormArray|PersistedArray)$/, '');
    const formGroupPath = `${relativePath}/${kebabCase(boBase)}-form-group`;
    if (!byFormGroup.has(formGroupPath)) {
      byFormGroup.set(formGroupPath, []);
    }
    byFormGroup.get(formGroupPath)!.push(boName);
  }

  for (const [path, names] of Array.from(byFormGroup).sort((a, b) => a[0].localeCompare(b[0]))) {
    writableFile.addImportDeclaration({
      moduleSpecifier: path,
      namedImports: names.sort()
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

    let where: string | undefined;
    let include: string | undefined;
    let order: string | undefined;
    let fields: string | undefined;
    let omit: string | undefined;
    let limit: string | undefined;
    let offset: string | undefined;
    let required: string | undefined;
    let disabled: string | undefined;
    if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
      const whereProp = args[0].getProperty('where');
      if (whereProp && Node.isPropertyAssignment(whereProp)) {
        where = whereProp.getInitializerOrThrow().getText();
      }
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
      const requiredProp = args[0].getProperty('required');
      if (requiredProp && Node.isPropertyAssignment(requiredProp)) {
        required = requiredProp.getInitializerOrThrow().getText();
      }
      const disabledProp = args[0].getProperty('disabled');
      if (disabledProp && Node.isPropertyAssignment(disabledProp)) {
        disabled = disabledProp.getInitializerOrThrow().getText();
      }
      const fieldsProp = args[0].getProperty('fields');
      if (fieldsProp && Node.isPropertyAssignment(fieldsProp)) {
        fields = fieldsProp.getInitializerOrThrow().getText();
      }
      const omitProp = args[0].getProperty('omit');
      if (omitProp && Node.isPropertyAssignment(omitProp)) {
        omit = omitProp.getInitializerOrThrow().getText();
      }
      const limitProp = args[0].getProperty('limit');
      if (limitProp && Node.isPropertyAssignment(limitProp)) {
        limit = limitProp.getInitializerOrThrow().getText();
      }
      const offsetProp = args[0].getProperty('offset');
      if (offsetProp && Node.isPropertyAssignment(offsetProp)) {
        offset = offsetProp.getInitializerOrThrow().getText();
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
      formGroupProperties.push({ name: prop.getName(), typeName, readMode, saveMode, include, afterReadCall, required, disabled });
    } else if (typeName.endsWith('PersistedArray') || typeName.endsWith('FormArray')) {
      persistedArrayProperties.push({ name: prop.getName(), typeName, readMode, where, include, order, fields, omit, limit, offset, afterReadCall });
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
export function transformOnChangeProperties(exportedClass: ClassDeclaration, onChangeCallMap: Map<string, string>): void {
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
