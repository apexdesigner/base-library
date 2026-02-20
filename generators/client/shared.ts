/**
 * Shared utilities for client generators.
 *
 * Template parsing, element/directive/pipe extraction, and template import resolution.
 * Ported from angular-base-library/generators/user-interfaces/shared.ts
 */

import type { ClassDeclaration } from 'ts-morph';
import type { GenerationContext } from '@apexdesigner/generator';
import { getClassDecorator, getClassByBase } from '@apexdesigner/utilities';
import { kebabCase } from 'change-case';
import * as htmlparser2 from 'htmlparser2';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:shared');

// ============================================================================
// Template Parsing (using htmlparser2 with xmlMode for case preservation)
// ============================================================================

export interface ParsedTemplate {
  elements: Set<string>;
  attributes: Set<string>;
}

/**
 * Parse HTML template and extract element tag names and attribute names.
 * Uses htmlparser2 with xmlMode to preserve case (Angular templates are case-sensitive).
 */
export function parseTemplateHtml(html: string): ParsedTemplate {
  const debug = Debug.extend('parseTemplateHtml');
  const elements = new Set<string>();
  const attributes = new Set<string>();

  try {
    // Use xmlMode to preserve attribute case (Angular templates are case-sensitive)
    const document = htmlparser2.parseDocument(html, { xmlMode: true });

    function walkNode(node: any): void {
      if (node.name) {
        elements.add(node.name);
      }

      if (node.attribs) {
        for (const attrName of Object.keys(node.attribs)) {
          // Handle banana-in-box [(ngModel)] - must check before bracket notation
          if (attrName.startsWith('[(') && attrName.endsWith(')]')) {
            attributes.add(attrName.slice(2, -2));
          }
          // Handle bracket notation [attrName]
          else if (attrName.startsWith('[') && attrName.endsWith(']')) {
            attributes.add(attrName.slice(1, -1));
          }
          // Handle parenthesis notation (eventName)
          else if (attrName.startsWith('(') && attrName.endsWith(')')) {
            attributes.add(attrName.slice(1, -1));
          }
          // Handle structural directives *directiveName
          else if (attrName.startsWith('*')) {
            attributes.add(attrName.slice(1));
          }
          // Regular attribute
          else {
            attributes.add(attrName);
          }
        }
      }

      if (node.children) {
        for (const child of node.children) {
          walkNode(child);
        }
      }
    }

    walkNode(document);
    debug('parsed %d elements, %d attributes', elements.size, attributes.size);
  } catch (err) {
    debug('parse error: %s', err);
  }

  return { elements, attributes };
}

// ============================================================================
// Standard HTML elements and attributes (for filtering)
// ============================================================================

const STANDARD_HTML_ELEMENTS = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'button', 'input', 'form', 'label',
  'table', 'tr', 'td', 'th', 'thead', 'tbody',
  'main', 'section', 'header', 'footer', 'nav', 'article', 'aside',
  'img', 'br', 'hr', 'pre', 'code', 'strong', 'em', 'small', 'blockquote',
  'select', 'option', 'textarea', 'fieldset', 'legend',
  'iframe', 'video', 'audio', 'source', 'canvas',
  'svg', 'path', 'circle', 'rect', 'line', 'polygon', 'g',
]);

const STANDARD_HTML_ATTRIBUTES = new Set([
  'class', 'style', 'id', 'src', 'href', 'value', 'disabled', 'checked',
  'selected', 'readonly', 'required', 'type', 'name', 'placeholder',
  'alt', 'title', 'width', 'height', 'min', 'max', 'step',
  'maxlength', 'minlength', 'pattern', 'autocomplete', 'autofocus',
  'multiple', 'accept', 'target', 'rel', 'role', 'tabindex', 'hidden',
  'lang', 'dir', 'translate', 'contenteditable', 'draggable', 'spellcheck',
  'loading', 'decoding', 'crossorigin', 'referrerpolicy', 'sizes', 'srcset',
  'colspan', 'rowspan', 'scope', 'headers', 'for', 'form', 'action',
  'method', 'enctype', 'novalidate', 'formaction', 'formmethod',
  'formenctype', 'formnovalidate', 'formtarget', 'open', 'wrap',
  'rows', 'cols', 'label', 'async', 'defer', 'integrity', 'nonce',
  'slot', 'part', 'exportparts', 'xmlns', 'viewbox',
  'd', 'fill', 'stroke', 'cx', 'cy', 'r', 'x', 'y',
  'x1', 'y1', 'x2', 'y2', 'points', 'transform',
]);

// ============================================================================
// Selector and pipe extraction
// ============================================================================

/**
 * Extract element selectors from HTML template.
 * Only returns non-standard HTML elements that may be components.
 */
export function extractElementSelectors(html: string): Set<string> {
  const parsed = parseTemplateHtml(html);
  const selectors = new Set<string>();

  for (const element of parsed.elements) {
    if (!STANDARD_HTML_ELEMENTS.has(element.toLowerCase())) {
      selectors.add(element);
    }
  }

  return selectors;
}

/**
 * Extract directive selectors from HTML template.
 * Only returns actual HTML attributes, not property accesses in expressions.
 */
export function extractDirectiveSelectors(html: string): Set<string> {
  const parsed = parseTemplateHtml(html);
  const selectors = new Set<string>();

  for (const attr of parsed.attributes) {
    const lowerAttr = attr.toLowerCase();
    if (STANDARD_HTML_ATTRIBUTES.has(lowerAttr)) continue;
    if (lowerAttr.startsWith('data-') || lowerAttr.startsWith('aria-')) continue;
    selectors.add(attr);
  }

  return selectors;
}

/**
 * Check if a single selector part matches an attribute and element combination.
 * Handles simple selectors ([attr], attr), compound selectors (element[attr]),
 * multi-attribute selectors ([attr1][attr2]), and :not() pseudo-class suffixes.
 */
export function matchesDirectiveSelector(
  selectorPart: string,
  attribute: string,
  elements: Set<string>,
  allAttributes?: Set<string>
): boolean {
  const debug = Debug.extend('matchesDirectiveSelector');

  // Strip :not(...) suffixes from selector before matching
  let cleanSelector = selectorPart;
  while (cleanSelector.includes(':not(')) {
    cleanSelector = cleanSelector.replace(/:not\([^)]+\)/g, '');
  }
  debug('selectorPart: %s, cleanSelector: %s, attribute: %s', selectorPart, cleanSelector, attribute);

  const bracketSelector = `[${attribute}]`;

  // Simple selector: [attr] or attr
  if (cleanSelector === bracketSelector || cleanSelector === attribute) {
    return true;
  }

  // Compound selector: element[attr] (e.g., input[matAutocomplete])
  const compoundMatch = cleanSelector.match(/^([\w-]+)\[([^\]]+)\]$/);
  if (compoundMatch) {
    const [, elementName, attrName] = compoundMatch;
    if (attrName === attribute && elements.has(elementName)) {
      return true;
    }
  }

  // Multi-attribute selector: [attr1][attr2] (e.g., [confirm][confirmMessage])
  if (allAttributes && cleanSelector.includes('][')) {
    const attrMatches = cleanSelector.match(/\[([^\]]+)\]/g);
    if (attrMatches) {
      const requiredAttrs = attrMatches.map((m) => m.slice(1, -1));
      if (requiredAttrs.includes(attribute)) {
        const allPresent = requiredAttrs.every((attr) => allAttributes.has(attr));
        if (allPresent) {
          debug('multi-attribute selector match: %s requires %j, all present: %j', cleanSelector, requiredAttrs, allPresent);
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Extract pipe names from HTML template.
 */
export function extractPipeNames(html: string): Set<string> {
  const pipeNames = new Set<string>();

  // Match pipes in interpolation: {{value | pipeName}}
  const interpolationPipeRegex = /\{\{[^}]*\|\s*([\w]+)/g;
  let match;

  while ((match = interpolationPipeRegex.exec(html)) !== null) {
    pipeNames.add(match[1]);
  }

  // Match pipes in attribute expressions: attr="value | pipeName" or [attr]="value | pipeName"
  const attributePipeRegex = /[\w\[\]]+="[^"]*\|\s*([\w]+)/g;
  while ((match = attributePipeRegex.exec(html)) !== null) {
    pipeNames.add(match[1]);
  }

  return pipeNames;
}

// ============================================================================
// Template conversion (AD3 syntax -> Angular control flow)
// ============================================================================

/**
 * Convert AD3 template syntax to Angular control flow syntax.
 */
export function convertAd3Template(template: string): string {
  if (!template) return '';

  let result = template;

  // Convert <if condition="..."> to @if (...) {
  result = result.replace(/<if\s+condition="([^"]+)"\s*>/g, '@if ($1) {');
  result = result.replace(/<\/if>/g, '}');

  // Convert <else> to } @else {
  result = result.replace(/<else>/g, '} @else {');
  result = result.replace(/<\/else>/g, '');

  // Convert <else-if condition="..."> to } @else if (...) {
  result = result.replace(/<else-if\s+condition="([^"]+)"\s*>/g, '} @else if ($1) {');
  result = result.replace(/<\/else-if>/g, '');

  // Convert <for> with various attributes to @for
  result = result.replace(
    /<for\s+const="([^"]+)"\s+of="([^"]+)"(?:\s+trackBy="([^"]+)")?(?:\s+index="([^"]+)")?(?:\s+first="([^"]+)")?(?:\s+last="([^"]+)")?(?:\s+odd="([^"]+)")?(?:\s+even="([^"]+)")?(?:\s+count="([^"]+)")?\s*>/g,
    (
      _match: string,
      itemVar: string,
      collectionExpr: string,
      trackBy: string,
      index: string,
      first: string,
      last: string,
      odd: string,
      even: string,
      count: string
    ) => {
      const trackExpr = trackBy || '$index';
      let forStatement = `@for (${itemVar} of ${collectionExpr}; track ${trackExpr}) {`;

      const varDecls: string[] = [];
      if (index) varDecls.push(`${index} = $index`);
      if (first) varDecls.push(`${first} = $first`);
      if (last) varDecls.push(`${last} = $last`);
      if (odd) varDecls.push(`${odd} = $odd`);
      if (even) varDecls.push(`${even} = $even`);
      if (count) varDecls.push(`${count} = $count`);

      if (varDecls.length > 0) {
        forStatement += ' ' + varDecls.map((v) => `@let ${v};`).join(' ');
      }

      return forStatement;
    }
  );

  result = result.replace(/<\/for>/g, '}');

  // Convert <when-empty> to } @empty {
  result = result.replace(/<when-empty>/g, '} @empty {');
  result = result.replace(/<\/when-empty>/g, '');

  // Convert <switch expression="..."> to @switch (...) {
  result = result.replace(/<switch\s+expression="([^"]+)"\s*>/g, '@switch ($1) {');
  result = result.replace(/<\/switch>/g, '}');

  // Convert <case valueExpression="..."> to @case (...) {
  result = result.replace(/<case\s+valueExpression="([^"]+)"\s*>/g, '@case ($1) {');
  result = result.replace(/<\/case>/g, '}');

  // Convert <default> to @default {
  result = result.replace(/<default>/g, '@default {');
  result = result.replace(/<\/default>/g, '}');

  return result;
}

// ============================================================================
// Template import resolution
// ============================================================================

/**
 * Get required imports from template by analyzing element/directive/pipe usage
 * against extracted interface metadata (ComponentInterface, DirectiveInterface, PipeInterface).
 *
 * Also matches Component and Page metadata for cross-component imports.
 */
export async function getTemplateImports(
  classDecl: ClassDeclaration,
  context: GenerationContext,
  decoratorName: 'component' | 'page',
  outputFilePath?: string,
  templateHtml?: string
): Promise<Array<{ moduleSpecifier: string; namedImports: string[] }>> {
  const debug = Debug.extend('getTemplateImports');

  // Use provided template HTML or try to extract from decorator
  let finalTemplateHtml = templateHtml;

  if (!finalTemplateHtml) {
    const decorator = classDecl.getDecorator(decoratorName);
    if (!decorator) return [];

    const decoratorArgs = decorator.getArguments();
    if (decoratorArgs.length === 0) return [];

    const configArg = decoratorArgs[0];
    const configText = configArg.getText();

    const templateMatch = configText.match(/template:\s*`([^`]*)`/s);
    if (!templateMatch) return [];
    finalTemplateHtml = templateMatch[1];
  }

  debug('extracted template HTML: %j chars', finalTemplateHtml.length);

  // Parse template to get all elements (for compound selector matching) and filtered selectors
  const parsedTemplate = parseTemplateHtml(finalTemplateHtml);
  const allElements = parsedTemplate.elements;
  const elementSelectors = extractElementSelectors(finalTemplateHtml);
  const directiveSelectors = extractDirectiveSelectors(finalTemplateHtml);
  const pipeNames = extractPipeNames(finalTemplateHtml);
  debug(
    'found %j all elements, %j element selectors, %j directive selectors, %j pipes',
    allElements.size,
    elementSelectors.size,
    directiveSelectors.size,
    pipeNames.size
  );

  // Load interface metadata
  const componentMetadata = context.listMetadata('Component') || [];
  const pageMetadata = context.listMetadata('Page') || [];
  const elementInterfaceMetadata = context.listMetadata('ComponentInterface') || [];
  const directiveInterfaceMetadata = context.listMetadata('DirectiveInterface') || [];
  const pipeInterfaceMetadata = context.listMetadata('PipeInterface') || [];

  // Extract selector and imports from metadata
  const components = componentMetadata.map((m) => ({
    name: m.name,
    selector: (getClassDecorator(getClassByBase(m.sourceFile, 'Component')!, 'component') || {}).selector as string || kebabCase(m.name.replace(/Component$/, '')),
  }));
  const pages = pageMetadata.map((m) => ({
    name: m.name,
    selector: (getClassDecorator(getClassByBase(m.sourceFile, 'Page')!, 'page') || {}).selector as string || kebabCase(m.name),
  }));

  // Helper: extract imports from source file's non-framework import statements
  const extractInterfaceImports = (sourceFile: any): Array<{ name: string; from: string }> => {
    const imports: Array<{ name: string; from: string }> = [];
    for (const imp of sourceFile.getImportDeclarations()) {
      const moduleSpec = imp.getModuleSpecifierValue();
      if (!moduleSpec.startsWith('@apexdesigner/dsl')) {
        for (const named of imp.getNamedImports()) {
          imports.push({ name: named.getName(), from: moduleSpec });
        }
      }
    }
    return imports;
  };

  const elementInterfaces = elementInterfaceMetadata.map((m) => {
    const options = getClassDecorator(getClassByBase(m.sourceFile, 'ComponentInterface')!, 'componentInterface') || {};
    return {
      name: m.name,
      selector: options.selector as string || '',
      imports: extractInterfaceImports(m.sourceFile),
    };
  });
  const directiveInterfaces = directiveInterfaceMetadata.map((m) => {
    const options = getClassDecorator(getClassByBase(m.sourceFile, 'DirectiveInterface')!, 'directiveInterface') || {};
    return {
      name: m.name,
      selector: options.selector as string || '',
      imports: extractInterfaceImports(m.sourceFile),
    };
  });
  const pipeInterfaces = pipeInterfaceMetadata.map((m) => {
    const options = getClassDecorator(getClassByBase(m.sourceFile, 'PipeInterface')!, 'pipeInterface') || {};
    return {
      name: m.name,
      selector: options.selector as string || '',
      imports: extractInterfaceImports(m.sourceFile),
    };
  });
  debug(
    'found %j components, %j pages, %j element interfaces, %j directive interfaces, %j pipe interfaces',
    components.length,
    pages.length,
    elementInterfaces.length,
    directiveInterfaces.length,
    pipeInterfaces.length
  );

  const importsMap = new Map<string, Set<string>>();

  // Process element selectors
  for (const selector of elementSelectors) {
    const matchingComponent = components.find((c) => c.selector === selector);
    if (matchingComponent) {
      debug('found component for selector %j: %j', selector, matchingComponent.name);
      const compKebab = kebabCase(matchingComponent.name.replace(/Component$/, ''));
      const importPath = `@components/${compKebab}/${compKebab}.component`;
      if (!importsMap.has(importPath)) importsMap.set(importPath, new Set());
      importsMap.get(importPath)!.add(matchingComponent.name);
      continue;
    }

    const matchingPage = pages.find((p) => p.selector === selector);
    if (matchingPage) {
      debug('found page for selector %j: %j', selector, matchingPage.name);
      const importPath = '@pages';
      if (!importsMap.has(importPath)) importsMap.set(importPath, new Set());
      importsMap.get(importPath)!.add(matchingPage.name + 'Page');
      continue;
    }

    const matchingInterface = elementInterfaces.find((ei) => {
      const selectorParts = ei.selector.split(',').map((s) => s.trim());
      return selectorParts.some((part) => part === selector);
    });
    if (matchingInterface && matchingInterface.imports && matchingInterface.imports.length > 0) {
      debug('found element interface for %j: %j', selector, matchingInterface.name);
      for (const imp of matchingInterface.imports) {
        if (imp.name && imp.from) {
          if (!importsMap.has(imp.from)) importsMap.set(imp.from, new Set());
          importsMap.get(imp.from)!.add(imp.name);
        }
      }
    }
  }

  // Process directive selectors
  for (const selector of directiveSelectors) {
    const matchingInterface = directiveInterfaces.find((di) => {
      const diSelector = di.selector;
      const selectorParts = diSelector.split(',').map((s) => s.trim());
      return selectorParts.some((part) =>
        matchesDirectiveSelector(part, selector, allElements, directiveSelectors)
      );
    });

    if (matchingInterface && matchingInterface.imports && matchingInterface.imports.length > 0) {
      debug('found directive interface for %j: %j', selector, matchingInterface.name);
      for (const imp of matchingInterface.imports) {
        if (imp.name && imp.from) {
          if (!importsMap.has(imp.from)) importsMap.set(imp.from, new Set());
          importsMap.get(imp.from)!.add(imp.name);
        }
      }
    }
  }

  // Process pipe names
  for (const pipeName of pipeNames) {
    const matchingInterface = pipeInterfaces.find((pi) => pi.selector === pipeName);
    if (matchingInterface && matchingInterface.imports && matchingInterface.imports.length > 0) {
      debug('found pipe interface for %j: %j', pipeName, matchingInterface.name);
      for (const imp of matchingInterface.imports) {
        if (imp.name && imp.from) {
          if (!importsMap.has(imp.from)) importsMap.set(imp.from, new Set());
          importsMap.get(imp.from)!.add(imp.name);
        }
      }
    }
  }

  return Array.from(importsMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([moduleSpecifier, namedImports]) => ({
      moduleSpecifier,
      namedImports: Array.from(namedImports).sort((a, b) => a.localeCompare(b)),
    }));
}
