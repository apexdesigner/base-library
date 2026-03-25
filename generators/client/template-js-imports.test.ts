import { describe, it, expect } from 'vitest';
import { extractTemplateUsage } from './template-js-imports.js';

describe('extractTemplateUsage', () => {
  it('should extract non-standard elements', () => {
    const usage = extractTemplateUsage([{ element: 'mat-toolbar', contains: [{ element: 'div' }] }, { 'flex-row': [{ span: 'hello' }] }]);
    expect(usage.elements.has('mat-toolbar')).toBe(true);
    expect(usage.elements.has('flex-row')).toBe(true);
    expect(usage.elements.has('div')).toBe(false);
    expect(usage.elements.has('span')).toBe(false);
  });

  it('should extract directive attributes from attributes object', () => {
    const usage = extractTemplateUsage({
      element: 'input',
      attributes: { matInput: null, type: 'text' }
    });
    expect(usage.directives.has('matInput')).toBe(true);
    expect(usage.directives.has('type')).toBe(false);
  });

  it('should extract pipes from text expressions', () => {
    const usage = extractTemplateUsage({
      element: 'div',
      text: '{{value | async}}'
    });
    expect(usage.pipes.has('async')).toBe(true);
  });

  it('should extract pipes from attribute expressions', () => {
    const usage = extractTemplateUsage({
      element: 'div',
      attributes: { disabled: '<- isDisabled | async' }
    });
    expect(usage.pipes.has('async')).toBe(true);
  });

  it('should extract pipes from if conditions', () => {
    const usage = extractTemplateUsage({
      if: 'authService.authenticated | async',
      contains: [{ element: 'div', text: 'hello' }]
    });
    expect(usage.pipes.has('async')).toBe(true);
  });

  it('should track standard HTML elements for compound directive selector matching', () => {
    // mat-icon-button directive has selector "button[mat-icon-button]"
    // The element "button" is standard HTML, but must be available
    // for matchesDirectiveSelector to match compound selectors.
    const usage = extractTemplateUsage({
      element: 'button',
      attributes: { 'mat-icon-button': null, matMenuTriggerFor: '<- userMenu' },
      contains: [{ 'mat-icon': 'person' }]
    });
    // "button" is standard HTML so not in elements
    expect(usage.elements.has('button')).toBe(false);
    // but mat-icon-button should be in directives
    expect(usage.directives.has('mat-icon-button')).toBe(true);
    // and the allElements set should include "button" for compound selector matching
    expect(usage.allElements.has('button')).toBe(true);
    expect(usage.allElements.has('mat-icon')).toBe(true);
  });

  it('should include standard elements in allElements but not elements', () => {
    const usage = extractTemplateUsage([
      { element: 'div', contains: [{ element: 'mat-toolbar' }] },
      { element: 'button', attributes: { 'mat-raised-button': null } }
    ]);
    expect(usage.elements.has('mat-toolbar')).toBe(true);
    expect(usage.elements.has('div')).toBe(false);
    expect(usage.elements.has('button')).toBe(false);
    expect(usage.allElements.has('div')).toBe(true);
    expect(usage.allElements.has('button')).toBe(true);
    expect(usage.allElements.has('mat-toolbar')).toBe(true);
  });

  it('should handle mat-action-list element and mat-list-item directive on <a>', () => {
    // Simulates: <mat-action-list><a mat-list-item routerLink="/foo">Link</a></mat-action-list>
    const usage = extractTemplateUsage({
      element: 'mat-action-list',
      contains: [
        {
          element: 'a',
          text: 'Process Designs',
          attributes: { 'mat-list-item': null, routerLink: '/process-designs' }
        }
      ]
    });
    // mat-action-list is a non-standard element
    expect(usage.elements.has('mat-action-list')).toBe(true);
    // "a" is standard HTML — not in elements but in allElements
    expect(usage.elements.has('a')).toBe(false);
    expect(usage.allElements.has('a')).toBe(true);
    // mat-list-item and routerLink are directives
    expect(usage.directives.has('mat-list-item')).toBe(true);
    expect(usage.directives.has('routerLink')).toBe(true);
  });

  it('should walk children inside element shorthand with array value', () => {
    // Shorthand: { 'mat-action-list': [ ...children ] } instead of
    //            { element: 'mat-action-list', contains: [ ...children ] }
    const usage = extractTemplateUsage([
      {
        'flex-column': [
          { h1: 'Process Engine Library' },
          {
            'mat-action-list': [
              {
                element: 'a',
                text: 'Process Designs',
                attributes: { 'mat-list-item': null, routerLink: '/process-designs' }
              },
              {
                element: 'a',
                text: 'Roles',
                attributes: { 'mat-list-item': null, routerLink: '/roles' }
              }
            ]
          }
        ]
      }
    ]);
    expect(usage.elements.has('flex-column')).toBe(true);
    expect(usage.elements.has('mat-action-list')).toBe(true);
    expect(usage.allElements.has('a')).toBe(true);
    expect(usage.directives.has('mat-list-item')).toBe(true);
    expect(usage.directives.has('routerLink')).toBe(true);
  });
});
