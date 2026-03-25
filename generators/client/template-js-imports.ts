import type { GenerationContext } from '@apexdesigner/generator';
import { getClassByBase, getClassDecorator, matchesDirectiveSelector } from '@apexdesigner/utilities';
import { templateReservedKeys } from '@apexdesigner/dsl';
import { kebabCase } from 'change-case';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:generators:templateJsImports');

// Standard HTML elements and Angular built-ins that don't need imports
const STANDARD_HTML_ELEMENTS = new Set([
  'ng-content',
  'ng-container',
  'ng-template',
  'a',
  'abbr',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'base',
  'bdi',
  'bdo',
  'blockquote',
  'body',
  'br',
  'button',
  'canvas',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'hr',
  'html',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'link',
  'main',
  'map',
  'mark',
  'menu',
  'meta',
  'meter',
  'nav',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'script',
  'search',
  'section',
  'select',
  'slot',
  'small',
  'source',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'track',
  'u',
  'ul',
  'var',
  'video',
  'wbr'
]);

// Standard HTML attributes that aren't directives
const STANDARD_HTML_ATTRIBUTES = new Set([
  'class',
  'id',
  'style',
  'title',
  'lang',
  'dir',
  'hidden',
  'tabindex',
  'accesskey',
  'draggable',
  'spellcheck',
  'contenteditable',
  'translate',
  'role',
  'slot',
  'is',
  'part',
  'exportparts',
  'inputmode',
  'enterkeyhint',
  'autocomplete',
  'autofocus',
  'disabled',
  'name',
  'type',
  'value',
  'placeholder',
  'readonly',
  'required',
  'multiple',
  'checked',
  'selected',
  'href',
  'src',
  'alt',
  'width',
  'height',
  'target',
  'rel',
  'download',
  'action',
  'method',
  'enctype',
  'novalidate',
  'for',
  'form',
  'max',
  'min',
  'step',
  'pattern',
  'size',
  'maxlength',
  'minlength',
  'accept',
  'list',
  'rows',
  'cols',
  'wrap',
  'open',
  'label',
  'loading',
  'decoding',
  'crossorigin',
  'referrerpolicy',
  'integrity',
  'async',
  'defer',
  'charset',
  'content',
  'http-equiv',
  'media',
  'sizes',
  'srcset',
  'scope',
  'colspan',
  'rowspan',
  'headers',
  'start',
  'reversed',
  'cite',
  'datetime'
]);

const RESERVED_KEYS = new Set(templateReservedKeys);

export interface TemplateUsage {
  elements: Set<string>;
  /** All element tags including standard HTML — needed for compound directive selector matching */
  allElements: Set<string>;
  directives: Set<string>;
  pipes: Set<string>;
}

/**
 * Extract element selectors, directive selectors, and pipe names
 * from a JS object template tree.
 */
export function extractTemplateUsage(template: any): TemplateUsage {
  const usage: TemplateUsage = {
    elements: new Set(),
    allElements: new Set(),
    directives: new Set(),
    pipes: new Set()
  };
  walkNode(template, usage);
  return usage;
}

function walkNode(node: any, usage: TemplateUsage): void {
  if (Array.isArray(node)) {
    for (const child of node) walkNode(child, usage);
    return;
  }
  if (typeof node !== 'object' || node === null) return;

  // Control flow nodes — scan expressions for pipes, recurse into children
  if ('if' in node) {
    extractPipesFromExpr(node.if, usage.pipes);
    walkChildren(node, usage);
    return;
  }
  if ('for' in node && 'of' in node) {
    walkChildren(node, usage);
    return;
  }
  if ('switch' in node) {
    extractPipesFromExpr(node.switch, usage.pipes);
    if (Array.isArray(node.cases)) {
      for (const c of node.cases) {
        if (Array.isArray(c.contains)) walkNode(c.contains, usage);
      }
    } else if (typeof node.cases === 'object') {
      for (const children of Object.values(node.cases)) {
        if (Array.isArray(children)) walkNode(children as any, usage);
      }
    }
    if (Array.isArray(node.otherwiseContains)) walkNode(node.otherwiseContains, usage);
    return;
  }

  // Element node — extract tag
  const tag = resolveTag(node);
  if (tag) {
    usage.allElements.add(tag);
    if (!STANDARD_HTML_ELEMENTS.has(tag)) {
      usage.elements.add(tag);
    }
  }

  // Scan the attributes object
  const attributes = node.attributes as Record<string, any> | undefined;
  if (attributes) {
    scanAttributes(attributes, usage);
  }

  // Scan text for pipes
  if (typeof node.text === 'string') {
    extractPipesFromExpr(node.text, usage.pipes);
  }
  // Shorthand text or children
  if (tag && typeof node[tag] === 'string') {
    extractPipesFromExpr(node[tag], usage.pipes);
  } else if (tag && Array.isArray(node[tag])) {
    walkNode(node[tag], usage);
  }

  walkChildren(node, usage);
}

function scanAttributes(attributes: Record<string, any>, usage: TemplateUsage): void {
  for (const [attrName, value] of Object.entries(attributes)) {
    // Collect non-standard attributes as potential directives
    const baseAttr = attrName.replace(/\..+$/, '');
    if (!STANDARD_HTML_ATTRIBUTES.has(baseAttr) && !baseAttr.startsWith('data-') && !baseAttr.startsWith('aria-')) {
      usage.directives.add(attrName);
    }

    // Scan string values for pipes
    if (typeof value === 'string') {
      let expr = value;
      if (expr.startsWith('<- ')) expr = expr.slice(3);
      else if (expr.startsWith('-> ')) expr = expr.slice(3);
      else if (expr.startsWith('<-> ')) expr = expr.slice(4);
      extractPipesFromExpr(expr, usage.pipes);
    }
  }
}

function walkChildren(node: Record<string, any>, usage: TemplateUsage): void {
  if (Array.isArray(node.contains)) walkNode(node.contains, usage);
  if (Array.isArray(node.elseContains)) walkNode(node.elseContains, usage);
  if (Array.isArray(node.emptyContains)) walkNode(node.emptyContains, usage);
  if (Array.isArray(node.otherwiseContains)) walkNode(node.otherwiseContains, usage);
}

function resolveTag(node: Record<string, any>): string | undefined {
  if (node.element) return node.element;
  for (const [key, value] of Object.entries(node)) {
    if (RESERVED_KEYS.has(key)) continue;
    if (typeof value === 'string' || Array.isArray(value)) {
      if (typeof value === 'string' && (value.startsWith('<- ') || value.startsWith('-> ') || value.startsWith('<-> '))) continue;
      return key;
    }
  }
  return undefined;
}

/** Extract pipe names from an expression string */
function extractPipesFromExpr(expr: string, pipes: Set<string>): void {
  if (!expr || !expr.includes('|')) return;
  const pipeRegex = /\|\s*([a-zA-Z]\w*)(?:\s*:|[^|]|$)/g;
  let match;
  while ((match = pipeRegex.exec(expr)) !== null) {
    const pos = match.index;
    if (pos > 0 && expr[pos - 1] === '|') continue;
    pipes.add(match[1]);
  }
}

/**
 * Resolve template imports from extracted JS template usage against design metadata.
 */
export async function resolveJsTemplateImports(
  context: GenerationContext,
  usage: TemplateUsage
): Promise<Array<{ moduleSpecifier: string; namedImports: string[] }>> {
  const componentMetadata = context.listMetadata('Component') || [];
  const pageMetadata = context.listMetadata('Page') || [];
  const elementInterfaceMetadata = context.listMetadata('ComponentInterface') || [];
  const directiveInterfaceMetadata = context.listMetadata('DirectiveInterface') || [];
  const pipeInterfaceMetadata = context.listMetadata('PipeInterface') || [];

  const components = componentMetadata.map(m => ({
    name: m.name,
    selector:
      (getClassDecorator(getClassByBase(m.sourceFile, 'Component'), 'component') || ({} as any)).selector ||
      kebabCase(m.name.replace(/Component$/, ''))
  }));

  const pages = pageMetadata.map(m => ({
    name: m.name,
    selector: (getClassDecorator(getClassByBase(m.sourceFile, 'Page'), 'page') || ({} as any)).selector || kebabCase(m.name)
  }));

  const extractInterfaceImports = (sourceFile: any) => {
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

  const elementInterfaces = elementInterfaceMetadata.map(m => {
    const options = getClassDecorator(getClassByBase(m.sourceFile, 'ComponentInterface'), 'componentInterface') || ({} as any);
    return { name: m.name, selector: options.selector || '', imports: extractInterfaceImports(m.sourceFile) };
  });

  const directiveInterfaces = directiveInterfaceMetadata.map(m => {
    const options = getClassDecorator(getClassByBase(m.sourceFile, 'DirectiveInterface'), 'directiveInterface') || ({} as any);
    return { name: m.name, selector: options.selector || '', imports: extractInterfaceImports(m.sourceFile) };
  });

  const pipeInterfaces = pipeInterfaceMetadata.map(m => {
    const options = getClassDecorator(getClassByBase(m.sourceFile, 'PipeInterface'), 'pipeInterface') || ({} as any);
    return { name: m.name, selector: options.selector || '', imports: extractInterfaceImports(m.sourceFile) };
  });

  debug('elements %j, directives %j, pipes %j', [...usage.elements], [...usage.directives], [...usage.pipes]);

  const importsMap = new Map<string, Set<string>>();

  // Process element selectors
  const unknownSelectors: string[] = [];
  for (const selector of usage.elements) {
    const matchingComponent = components.find(c => c.selector === selector);
    if (matchingComponent) {
      const compKebab = kebabCase(matchingComponent.name.replace(/Component$/, ''));
      const importPath = `@components/${compKebab}/${compKebab}.component`;
      if (!importsMap.has(importPath)) importsMap.set(importPath, new Set());
      importsMap.get(importPath)!.add(matchingComponent.name);
      continue;
    }

    const matchingPage = pages.find(p => p.selector === selector);
    if (matchingPage) {
      const importPath = '@pages';
      if (!importsMap.has(importPath)) importsMap.set(importPath, new Set());
      importsMap.get(importPath)!.add(matchingPage.name + 'Page');
      continue;
    }

    const matchingInterface = elementInterfaces.find(ei => {
      const selectorParts = ei.selector.split(',').map(s => s.trim());
      return selectorParts.some(part => part === selector);
    });
    if (matchingInterface) {
      for (const imp of matchingInterface.imports) {
        if (imp.name && imp.from) {
          if (!importsMap.has(imp.from)) importsMap.set(imp.from, new Set());
          importsMap.get(imp.from)!.add(imp.name);
        }
      }
      continue;
    }

    unknownSelectors.push(selector);
  }

  if (unknownSelectors.length > 0) {
    throw new Error(
      `Unknown element selector(s) in template: ${unknownSelectors.map(s => `<${s}>`).join(', ')}. ` +
        `Each must be a standard HTML element, a component or page in this project, or have a ComponentInterface registered in a library.`
    );
  }

  // Process directive selectors
  for (const attr of usage.directives) {
    const matchingInterface = directiveInterfaces.find(di => {
      const selectorParts = di.selector.split(',').map(s => s.trim());
      return selectorParts.some(part => matchesDirectiveSelector(part, attr, usage.allElements, usage.directives));
    });
    if (matchingInterface?.imports?.length) {
      for (const imp of matchingInterface.imports) {
        if (imp.name && imp.from) {
          if (!importsMap.has(imp.from)) importsMap.set(imp.from, new Set());
          importsMap.get(imp.from)!.add(imp.name);
        }
      }
    }
  }

  // Process pipe names
  for (const pipeName of usage.pipes) {
    const matchingInterface = pipeInterfaces.find(pi => pi.selector === pipeName);
    if (matchingInterface?.imports?.length) {
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
      namedImports: Array.from(namedImports).sort()
    }));
}
