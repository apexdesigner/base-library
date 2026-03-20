import { getModuleLevelCall, getTemplateString } from '@apexdesigner/utilities';
import { convertAd3Template } from '@apexdesigner/generator';
import { getTemplateObjectArg, convertJsTemplateToAngular, extractTemplateRefs } from './template-js-to-angular.js';
import type { SourceFile } from 'ts-morph';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:generators:templateExtraction');

export interface ExtractedTemplate {
  /** The Angular template HTML ready to write to .html file */
  angularHtml: string;
  /** The HTML to pass to getTemplateImports for selector resolution */
  htmlForImports: string;
  /** Template reference names (for ViewChild matching) */
  templateRefs: Set<string>;
}

/**
 * Extract and convert a template from an applyTemplate() call.
 * Supports both string-based (AD3 HTML, deprecated) and JS object formats.
 * Returns the Angular HTML output regardless of input format.
 */
export function extractTemplate(sourceFile: SourceFile): ExtractedTemplate {
  const applyTemplateCall = getModuleLevelCall(sourceFile, 'applyTemplate');
  if (!applyTemplateCall) {
    return { angularHtml: '', htmlForImports: '', templateRefs: new Set() };
  }

  // Try JS object format first (preferred)
  const jsTemplate = getTemplateObjectArg(applyTemplateCall);
  if (jsTemplate) {
    debug('using JS object template format');
    const angularHtml = convertJsTemplateToAngular(jsTemplate);
    const templateRefs = extractTemplateRefs(jsTemplate);
    return { angularHtml, htmlForImports: angularHtml, templateRefs };
  }

  // Fall back to string-based AD3 format (deprecated)
  const ad3Template = getTemplateString(applyTemplateCall) || '';
  debug('using string template format (deprecated), %d chars', ad3Template.length);
  const angularHtml = convertAd3Template(ad3Template);
  const templateRefs = new Set([...ad3Template.matchAll(/#(\w+)/g)].map(m => m[1]));
  return { angularHtml, htmlForImports: ad3Template, templateRefs };
}
