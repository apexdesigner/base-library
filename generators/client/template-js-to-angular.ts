import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression } from 'ts-morph';
import { templateReservedKeys } from '@apexdesigner/dsl';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:generators:templateJsToAngular');

// HTML void elements that must not have closing tags
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const RESERVED_KEYS = new Set(templateReservedKeys);

/**
 * Try to extract a JS object/array template from an applyTemplate() call.
 * Returns undefined if the second argument is not an object/array literal
 * (i.e., it's a string template — use getTemplateString instead).
 */
export function getTemplateObjectArg(callExpression: CallExpression): any | undefined {
  const args = callExpression.getArguments();
  const templateArg = args[1];
  if (!templateArg) return undefined;

  if (templateArg.getKind() === SyntaxKind.ArrayLiteralExpression) {
    return evalNode(templateArg);
  }
  if (templateArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
    return evalNode(templateArg);
  }

  return undefined;
}

/**
 * Evaluate a ts-morph AST node to a plain JS value.
 */
function evalNode(node: any): any {
  if (Node.isStringLiteral(node)) {
    return node.getLiteralValue();
  }
  if (Node.isNumericLiteral(node)) {
    return node.getLiteralValue();
  }
  if (node.getKind() === SyntaxKind.TrueKeyword) {
    return true;
  }
  if (node.getKind() === SyntaxKind.FalseKeyword) {
    return false;
  }
  if (node.getKind() === SyntaxKind.NullKeyword) {
    return null;
  }
  if (Node.isArrayLiteralExpression(node)) {
    return node.getElements().map((el: any) => evalNode(el));
  }
  if (Node.isObjectLiteralExpression(node)) {
    const result: Record<string, any> = {};
    for (const prop of node.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName().replace(/^['"]|['"]$/g, '');
        const init = prop.getInitializer();
        if (init) {
          result[name] = evalNode(init);
        }
      }
    }
    return result;
  }
  return node.getText();
}

/**
 * Convert a JS object/array template to Angular template HTML.
 */
export function convertJsTemplateToAngular(template: any): string {
  if (Array.isArray(template)) {
    return template.map(item => convertNode(item, 0)).join('\n');
  }
  return convertNode(template, 0);
}

function convertNode(node: any, depth: number): string {
  if (typeof node === 'string') {
    return indent(depth) + node;
  }
  if (typeof node !== 'object' || node === null) {
    return '';
  }

  if ('if' in node) return convertIf(node, depth);
  if ('for' in node && 'of' in node) return convertFor(node, depth);
  if ('switch' in node) return convertSwitch(node, depth);

  return convertElement(node, depth);
}

function convertElement(node: Record<string, any>, depth: number): string {
  // Detect element tag — explicit or shorthand
  let tag = node.element as string | undefined;
  let text = node.text as string | undefined;
  let contains = node.contains as any[] | undefined;

  // Shorthand detection: a non-reserved key with string or array value
  if (!tag) {
    for (const [key, value] of Object.entries(node)) {
      if (RESERVED_KEYS.has(key)) continue;
      if (typeof value === 'string' || Array.isArray(value)) {
        // Skip if it looks like a binding prefix
        if (typeof value === 'string' && (value.startsWith('<- ') || value.startsWith('-> ') || value.startsWith('<-> '))) {
          continue;
        }
        tag = key;
        if (typeof value === 'string') {
          text = value;
        } else {
          contains = value;
        }
        break;
      }
    }
  }

  if (!tag) {
    debug('no element tag found in node %j', node);
    return '';
  }

  // Build attributes
  const attrs: string[] = [];

  // Template reference — only emit #name when referenceable
  if (node.referenceable && node.name) {
    attrs.push(`#${node.name}`);
  }

  // Process the attributes object
  const attributes = node.attributes as Record<string, any> | undefined;
  if (attributes) {
    for (const [attrName, value] of Object.entries(attributes)) {
      attrs.push(convertAttribute(attrName, value));
    }
  }

  // Also process top-level keys that aren't reserved (for backward compat / shorthand attributes)
  for (const [key, value] of Object.entries(node)) {
    if (RESERVED_KEYS.has(key) || key === tag || key === 'attributes') continue;
    // Skip — these are handled above or aren't attributes
    if (typeof value === 'string' && !value.startsWith('<- ') && !value.startsWith('-> ') && !value.startsWith('<-> ')) continue;
    if (typeof value !== 'string') continue;
    attrs.push(convertAttribute(key, value));
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Self-closing if no text and no children
  if (!text && !contains) {
    if (VOID_ELEMENTS.has(tag)) {
      return indent(depth) + `<${tag}${attrStr} />`;
    }
    return indent(depth) + `<${tag}${attrStr}></${tag}>`;
  }

  // Text-only element
  if (text && !contains) {
    return indent(depth) + `<${tag}${attrStr}>${text}</${tag}>`;
  }

  // Element with children
  const lines: string[] = [];
  lines.push(indent(depth) + `<${tag}${attrStr}>`);
  if (text) {
    lines.push(indent(depth + 1) + text);
  }
  if (contains) {
    for (const child of contains) {
      lines.push(convertNode(child, depth + 1));
    }
  }
  lines.push(indent(depth) + `</${tag}>`);
  return lines.join('\n');
}

function convertAttribute(attrName: string, value: any): string {
  if (value === null) {
    // Bare attribute: matInput: null → matInput
    return attrName;
  }
  if (typeof value === 'string') {
    if (value.startsWith('<-> ')) {
      // Two-way binding: [(attr)]="expr"
      return `[(${attrName})]="${escapeAttr(value.slice(4))}"`;
    }
    if (value.startsWith('<- ')) {
      // Input binding: [attr]="expr"
      return `[${attrName}]="${escapeAttr(value.slice(3))}"`;
    }
    if (value.startsWith('-> ')) {
      // Event binding: (event)="action"
      return `(${attrName})="${escapeAttr(value.slice(3))}"`;
    }
    // Static value
    return `${attrName}="${escapeAttr(value)}"`;
  }
  if (typeof value === 'boolean') {
    // Bound boolean: [attr]="true" or [attr]="false"
    return `[${attrName}]="${value}"`;
  }
  if (typeof value === 'number') {
    // Bound number: [attr]="100"
    return `[${attrName}]="${value}"`;
  }
  return '';
}

function convertIf(node: Record<string, any>, depth: number): string {
  const lines: string[] = [];
  lines.push(indent(depth) + `@if (${node.if}) {`);
  if (node.contains) {
    for (const child of node.contains) {
      lines.push(convertNode(child, depth + 1));
    }
  }
  if (node.elseContains) {
    const elseItems = node.elseContains as any[];
    if (elseItems.length === 1 && typeof elseItems[0] === 'object' && 'if' in elseItems[0]) {
      lines.push(indent(depth) + `} @else ${convertIf(elseItems[0], depth).trimStart()}`);
      return lines.join('\n');
    }
    lines.push(indent(depth) + `} @else {`);
    for (const child of elseItems) {
      lines.push(convertNode(child, depth + 1));
    }
    lines.push(indent(depth) + `}`);
  } else {
    lines.push(indent(depth) + `}`);
  }
  return lines.join('\n');
}

function convertFor(node: Record<string, any>, depth: number): string {
  const lines: string[] = [];
  const trackExpr = node.trackBy || `$index`;
  const letParts: string[] = [];
  if (node.index) letParts.push(`${node.index} = $index`);
  if (node.first) letParts.push(`${node.first} = $first`);
  if (node.last) letParts.push(`${node.last} = $last`);
  if (node.odd) letParts.push(`${node.odd} = $odd`);
  if (node.even) letParts.push(`${node.even} = $even`);
  if (node.count) letParts.push(`${node.count} = $count`);

  let forLine = `@for (${node.for} of ${node.of}; track ${trackExpr}`;
  if (letParts.length > 0) {
    forLine += `; let ${letParts.join(', ')}`;
  }
  forLine += `) {`;

  lines.push(indent(depth) + forLine);
  if (node.contains) {
    for (const child of node.contains) {
      lines.push(convertNode(child, depth + 1));
    }
  }
  lines.push(indent(depth) + `}`);

  if (node.emptyContains) {
    lines.push(indent(depth) + `@empty {`);
    for (const child of node.emptyContains) {
      lines.push(convertNode(child, depth + 1));
    }
    lines.push(indent(depth) + `}`);
  }

  return lines.join('\n');
}

function convertSwitch(node: Record<string, any>, depth: number): string {
  const lines: string[] = [];
  lines.push(indent(depth) + `@switch (${node.switch}) {`);

  if (Array.isArray(node.cases)) {
    for (const c of node.cases) {
      lines.push(indent(depth + 1) + `@case (${c.case}) {`);
      if (c.contains) {
        for (const child of c.contains) {
          lines.push(convertNode(child, depth + 2));
        }
      }
      lines.push(indent(depth + 1) + `}`);
    }
  } else if (typeof node.cases === 'object') {
    for (const [value, children] of Object.entries(node.cases as Record<string, any[]>)) {
      lines.push(indent(depth + 1) + `@case ('${value}') {`);
      for (const child of children as any[]) {
        lines.push(convertNode(child, depth + 2));
      }
      lines.push(indent(depth + 1) + `}`);
    }
  }

  if (node.otherwiseContains) {
    lines.push(indent(depth + 1) + `@default {`);
    for (const child of node.otherwiseContains) {
      lines.push(convertNode(child, depth + 2));
    }
    lines.push(indent(depth + 1) + `}`);
  }

  lines.push(indent(depth) + `}`);
  return lines.join('\n');
}

/**
 * Extract template reference names from a JS object template tree.
 * Only returns names where referenceable: true.
 */
export function extractTemplateRefs(template: any): Set<string> {
  const refs = new Set<string>();
  collectRefs(template, refs);
  return refs;
}

function collectRefs(node: any, refs: Set<string>): void {
  if (Array.isArray(node)) {
    for (const child of node) collectRefs(child, refs);
    return;
  }
  if (typeof node !== 'object' || node === null) return;

  if (node.referenceable && typeof node.name === 'string') {
    refs.add(node.name);
  }

  if (Array.isArray(node.contains)) collectRefs(node.contains, refs);
  if (Array.isArray(node.elseContains)) collectRefs(node.elseContains, refs);
  if (Array.isArray(node.emptyContains)) collectRefs(node.emptyContains, refs);
  if (Array.isArray(node.otherwiseContains)) collectRefs(node.otherwiseContains, refs);

  if (node.cases) {
    if (Array.isArray(node.cases)) {
      for (const c of node.cases) {
        if (Array.isArray(c.contains)) collectRefs(c.contains, refs);
      }
    } else if (typeof node.cases === 'object') {
      for (const children of Object.values(node.cases)) {
        if (Array.isArray(children)) collectRefs(children, refs);
      }
    }
  }
}

function indent(depth: number): string {
  return '  '.repeat(depth);
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}
