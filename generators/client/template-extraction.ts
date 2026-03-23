import { getModuleLevelCall, getTemplateString } from '@apexdesigner/utilities';
import { convertAd3Template } from '@apexdesigner/generator';
import { getTemplateObjectArg, convertJsTemplateToAngular, extractTemplateRefs } from './template-js-to-angular.js';
import { extractTemplateUsage } from './template-js-imports.js';
import type { SourceFile } from 'ts-morph';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:generators:templateExtraction');

export interface ExtractedTemplate {
  /** The Angular template HTML ready to write to .html file */
  angularHtml: string;
  /** Template reference names (for ViewChild matching) */
  templateRefs: Set<string>;
  /** The raw JS template object (if JS format was used) */
  jsTemplate?: any;
  /** The raw AD3 HTML string (if string format was used, deprecated) */
  ad3Html?: string;
}

/**
 * Extract and convert a template from an applyTemplate() call.
 * Supports both string-based (AD3 HTML, deprecated) and JS object formats.
 * Returns the Angular HTML output regardless of input format.
 */
export function extractTemplate(sourceFile: SourceFile): ExtractedTemplate {
  const applyTemplateCall = getModuleLevelCall(sourceFile, 'applyTemplate');
  if (!applyTemplateCall) {
    return { angularHtml: '', templateRefs: new Set() };
  }

  // Try JS object format first (preferred)
  const jsTemplate = getTemplateObjectArg(applyTemplateCall);
  if (jsTemplate) {
    debug('using JS object template format');
    const angularHtml = convertJsTemplateToAngular(jsTemplate);
    const templateRefs = extractTemplateRefs(jsTemplate);
    return { angularHtml, templateRefs, jsTemplate };
  }

  // Fall back to string-based AD3 format (deprecated)
  const ad3Html = getTemplateString(applyTemplateCall) || '';
  debug('using string template format (deprecated), %d chars', ad3Html.length);
  const angularHtml = convertAd3Template(ad3Html);
  const templateRefs = new Set([...ad3Html.matchAll(/#(\w+)/g)].map(m => m[1]));
  return { angularHtml, templateRefs, ad3Html };
}

export { extractTemplateUsage } from './template-js-imports.js';
export { resolveJsTemplateImports } from './template-js-imports.js';
