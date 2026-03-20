import { Node, SyntaxKind } from 'ts-morph';
import type { CallExpression } from 'ts-morph';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:generators:templateJsToAngular');

// Reserved keys that are not attributes
const RESERVED_KEYS = new Set([
  'element', 'name', 'text', 'contains',
  'elseContains', 'emptyContains', 'otherwiseContains',
  'if', 'for', 'of', 'switch', 'cases', 'case',
  'trackBy', 'index', 'first', 'last', 'odd', 'even', 'count',
]);

/**
 * Try to extract a JS object/array template from an applyTemplate() call.
 * Returns undefined if the second argument is not an object/array literal
 * (i.e., it's a string template — use getTemplateString instead).
 */
export function getTemplateObjectArg(callExpression: CallExpression): any | undefined {
  const args = callExpression.getArguments();
  // Second argument (first is the class reference)
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
 * Handles object literals, array literals, strings, numbers, booleans.
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
        const name = prop.getName();
        const init = prop.getInitializer();
        if (init) {
          result[name] = evalNode(init);
        }
      }
    }
    return result;
  }
  // Fallback: return the raw text (for expressions we can't evaluate)
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
    return indent(depth) + escapeHtml(node);
  }
  if (typeof node !== 'object' || node === null) {
    return '';
  }

  // Control flow: if
  if ('if' in node) {
    return convertIf(node, depth);
  }

  // Control flow: for
  if ('for' in node && 'of' in node) {
    return convertFor(node, depth);
  }

  // Control flow: switch
  if ('switch' in node) {
    return convertSwitch(node, depth);
  }

  // Element node
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
      if (!RESERVED_KEYS.has(key) && !key.startsWith('attribute.')) {
        if (typeof value === 'string' || Array.isArray(value)) {
          // Check if it looks like a binding prefix — if so, it's an attribute not a tag
          if (typeof value === 'string' && (value.startsWith('= ') || value.startsWith('-> '))) {
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
  }

  if (!tag) {
    debug('no element tag found in node %j', node);
    return '';
  }

  // Build attributes
  const attrs: string[] = [];
  const templateRef = node.name as string | undefined;

  if (templateRef) {
    attrs.push(`#${templateRef}`);
  }

  for (const [key, value] of Object.entries(node)) {
    if (RESERVED_KEYS.has(key) || key === tag) continue;
    if (key === 'name') continue; // handled as template ref above

    // attribute. prefix for escaping reserved key collisions
    const attrName = key.startsWith('attribute.') ? key.slice('attribute.'.length) : key;

    if (typeof value === 'string') {
      if (value.startsWith('= ')) {
        // Expression binding: [attr]="expr"
        attrs.push(`[${attrName}]="${escapeAttr(value.slice(2))}"`);
      } else if (value.startsWith('-> ')) {
        // Event binding: (event)="action"
        attrs.push(`(${attrName})="${escapeAttr(value.slice(3))}"`);
      } else {
        // Static value
        attrs.push(`${attrName}="${escapeAttr(value)}"`);
      }
    } else if (typeof value === 'boolean') {
      if (value) {
        attrs.push(attrName);
      }
    } else if (typeof value === 'number') {
      attrs.push(`[${attrName}]="${value}"`);
    }
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Self-closing if no text and no children
  if (!text && !contains) {
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

function convertIf(node: Record<string, any>, depth: number): string {
  const lines: string[] = [];
  lines.push(indent(depth) + `@if (${node.if}) {`);
  if (node.contains) {
    for (const child of node.contains) {
      lines.push(convertNode(child, depth + 1));
    }
  }
  if (node.elseContains) {
    // Check if elseContains has a single item with 'if' — that's else-if
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

  // Build track expression
  const trackExpr = node.trackBy || `$index`;

  // Build variable assignments
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
    // Expression cases: [{ case: 'expr', contains: [...] }]
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
    // Value cases: { active: [...], pending: [...] }
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
 * Returns the set of `name` values found.
 */
export function extractTemplateRefs(template: any): Set<string> {
  const refs = new Set<string>();
  collectRefs(template, refs);
  return refs;
}

function collectRefs(node: any, refs: Set<string>): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectRefs(child, refs);
    }
    return;
  }
  if (typeof node !== 'object' || node === null) return;

  if (typeof node.name === 'string' && /^[a-z][a-zA-Z0-9]*$/.test(node.name)) {
    refs.add(node.name);
  }

  if (Array.isArray(node.contains)) collectRefs(node.contains, refs);
  if (Array.isArray(node.elseContains)) collectRefs(node.elseContains, refs);
  if (Array.isArray(node.emptyContains)) collectRefs(node.emptyContains, refs);
  if (Array.isArray(node.otherwiseContains)) collectRefs(node.otherwiseContains, refs);

  // Switch cases
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

function escapeHtml(text: string): string {
  return text; // Template text with {{}} should pass through as-is
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}
