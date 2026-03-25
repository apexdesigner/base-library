import { describe, it, expect } from 'vitest';
import { convertJsTemplateToAngular, extractTemplateRefs } from './template-js-to-angular.js';

describe('convertJsTemplateToAngular', () => {
  it('should convert a simple element with text', () => {
    const result = convertJsTemplateToAngular({ element: 'h3', text: 'Hello World' });
    expect(result).toBe('<h3>Hello World</h3>');
  });

  it('should convert element shorthand with text', () => {
    const result = convertJsTemplateToAngular({ h2: '{{organization.name}}' });
    expect(result).toBe('<h2>{{organization.name}}</h2>');
  });

  it('should convert element shorthand with children', () => {
    const result = convertJsTemplateToAngular({
      'flex-row': [{ span: '{{member.name}}' }, { 'mat-icon': 'delete' }]
    });
    expect(result).toContain('<flex-row>');
    expect(result).toContain('  <span>{{member.name}}</span>');
    expect(result).toContain('  <mat-icon>delete</mat-icon>');
    expect(result).toContain('</flex-row>');
  });

  it('should convert input bindings (<- prefix)', () => {
    const result = convertJsTemplateToAngular({
      element: 'flex-row',
      attributes: { gap: '<- 20' }
    });
    expect(result).toContain('[gap]="20"');
  });

  it('should convert event bindings (-> prefix)', () => {
    const result = convertJsTemplateToAngular({
      element: 'button',
      text: 'Save',
      attributes: { click: '-> save()' }
    });
    expect(result).toContain('(click)="save()"');
    expect(result).toContain('Save');
  });

  it('should convert two-way bindings (<-> prefix)', () => {
    const result = convertJsTemplateToAngular({
      element: 'student-card',
      attributes: { student: '<-> selectedStudent' }
    });
    expect(result).toContain('[(student)]="selectedStudent"');
  });

  it('should handle two-way binding with extra change event', () => {
    const result = convertJsTemplateToAngular({
      element: 'input',
      attributes: {
        ngModel: '<-> search',
        ngModelChange: '-> filterUsers()'
      }
    });
    expect(result).toContain('[(ngModel)]="search"');
    expect(result).toContain('(ngModelChange)="filterUsers()"');
  });

  it('should convert static attributes', () => {
    const result = convertJsTemplateToAngular({
      element: 'mat-progress-bar',
      attributes: { mode: 'indeterminate' }
    });
    expect(result).toContain('mode="indeterminate"');
  });

  it('should convert null to bare attribute', () => {
    const result = convertJsTemplateToAngular({
      element: 'input',
      attributes: { matInput: null }
    });
    expect(result).toContain('matInput');
    expect(result).not.toContain('matInput=');
  });

  it('should convert boolean to bound boolean', () => {
    const result = convertJsTemplateToAngular({
      element: 'input',
      attributes: { required: true, disabled: false }
    });
    expect(result).toContain('[required]="true"');
    expect(result).toContain('[disabled]="false"');
  });

  it('should convert number to bound number', () => {
    const result = convertJsTemplateToAngular({
      element: 'input',
      attributes: { maxLength: 100 }
    });
    expect(result).toContain('[maxLength]="100"');
  });

  it('should convert class and style bindings', () => {
    const result = convertJsTemplateToAngular({
      element: 'div',
      attributes: {
        'class.active': '<- isActive',
        'style.width.px': '<- columnWidth'
      }
    });
    expect(result).toContain('[class.active]="isActive"');
    expect(result).toContain('[style.width.px]="columnWidth"');
  });

  it('should emit #name only when referenceable', () => {
    const withRef = convertJsTemplateToAngular({
      element: 'input',
      name: 'searchInput',
      referenceable: true,
      attributes: { type: 'text' }
    });
    expect(withRef).toContain('#searchInput');

    const withoutRef = convertJsTemplateToAngular({
      element: 'dt-column',
      name: 'email',
      attributes: { property: 'email' }
    });
    expect(withoutRef).not.toContain('#email');
  });

  it('should not emit description', () => {
    const result = convertJsTemplateToAngular({
      element: 'div',
      description: 'This is a layout container',
      text: 'Hello'
    });
    expect(result).not.toContain('description');
    expect(result).not.toContain('layout container');
    expect(result).toBe('<div>Hello</div>');
  });

  it('should convert @if', () => {
    const result = convertJsTemplateToAngular({
      if: 'user.isActive',
      contains: [{ element: 'div', text: 'User is active' }]
    });
    expect(result).toContain('@if (user.isActive) {');
    expect(result).toContain('  <div>User is active</div>');
    expect(result).toContain('}');
  });

  it('should convert @if with else', () => {
    const result = convertJsTemplateToAngular({
      if: 'user.isActive',
      contains: [{ element: 'div', text: 'Active' }],
      elseContains: [{ element: 'div', text: 'Inactive' }]
    });
    expect(result).toContain('@if (user.isActive) {');
    expect(result).toContain('} @else {');
    expect(result).toContain('  <div>Inactive</div>');
  });

  it('should convert @if with else-if chain', () => {
    const result = convertJsTemplateToAngular({
      if: "status === 'active'",
      contains: [{ element: 'div', text: 'Active' }],
      elseContains: [
        {
          if: "status === 'pending'",
          contains: [{ element: 'div', text: 'Pending' }],
          elseContains: [{ element: 'div', text: 'Unknown' }]
        }
      ]
    });
    expect(result).toContain("@if (status === 'active') {");
    expect(result).toContain("} @else @if (status === 'pending') {");
    expect(result).toContain('} @else {');
  });

  it('should convert @for with track', () => {
    const result = convertJsTemplateToAngular({
      for: 'item',
      of: 'items',
      trackBy: 'item.id',
      contains: [{ element: 'div', text: '{{item.name}}' }]
    });
    expect(result).toContain('@for (item of items; track item.id) {');
    expect(result).toContain('  <div>{{item.name}}</div>');
  });

  it('should convert @for with default track $index', () => {
    const result = convertJsTemplateToAngular({
      for: 'item',
      of: 'items',
      contains: [{ element: 'div', text: '{{item.name}}' }]
    });
    expect(result).toContain('@for (item of items; track $index) {');
  });

  it('should convert @for with special variables', () => {
    const result = convertJsTemplateToAngular({
      for: 'item',
      of: 'items',
      trackBy: 'item.id',
      index: 'i',
      first: 'isFirst',
      last: 'isLast',
      contains: [{ element: 'div', text: '{{item.name}}' }]
    });
    expect(result).toContain('let i = $index, isFirst = $first, isLast = $last');
  });

  it('should convert @for with @empty', () => {
    const result = convertJsTemplateToAngular({
      for: 'item',
      of: 'items',
      contains: [{ element: 'div', text: '{{item.name}}' }],
      emptyContains: [{ element: 'div', text: 'No items' }]
    });
    expect(result).toContain('@empty {');
    expect(result).toContain('  <div>No items</div>');
  });

  it('should convert @switch with value cases', () => {
    const result = convertJsTemplateToAngular({
      switch: 'status',
      cases: {
        active: [{ element: 'div', text: 'Active' }],
        pending: [{ element: 'div', text: 'Pending' }]
      },
      otherwiseContains: [{ element: 'div', text: 'Unknown' }]
    });
    expect(result).toContain('@switch (status) {');
    expect(result).toContain("  @case ('active') {");
    expect(result).toContain("  @case ('pending') {");
    expect(result).toContain('  @default {');
  });

  it('should convert @switch with expression cases', () => {
    const result = convertJsTemplateToAngular({
      switch: 'score',
      cases: [
        { case: 'score > 90', contains: [{ element: 'div', text: 'Excellent' }] },
        { case: 'score > 70', contains: [{ element: 'div', text: 'Good' }] }
      ]
    });
    expect(result).toContain('@case (score > 90) {');
    expect(result).toContain('@case (score > 70) {');
  });

  it('should handle void elements', () => {
    const result = convertJsTemplateToAngular({
      element: 'input',
      attributes: { matInput: null, type: 'text' }
    });
    expect(result).toContain('<input');
    expect(result).toContain('/>');
    expect(result).not.toContain('</input>');
  });

  it('should handle the full example from the design doc', () => {
    const result = convertJsTemplateToAngular([
      {
        element: 'flex-column',
        attributes: { gap: '<- 20' },
        contains: [
          { h2: '{{organization.name}}' },
          {
            if: 'loading',
            contains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }]
          },
          {
            for: 'member',
            of: 'members',
            trackBy: 'member.id',
            index: 'i',
            contains: [
              {
                element: 'flex-row',
                attributes: { gap: '<- 12', 'class.first': '<- i === 0' },
                contains: [
                  { span: '{{i + 1}}. {{member.name}}' },
                  {
                    element: 'button',
                    attributes: {
                      click: '-> removeMember(member)',
                      matTooltip: 'Remove'
                    },
                    contains: [{ 'mat-icon': 'delete' }]
                  }
                ]
              }
            ],
            emptyContains: [{ span: 'No members yet' }]
          },
          {
            element: 'apex-delete-button',
            attributes: {
              object: '<- organization',
              afterDeleteRoute: '/organizations'
            }
          }
        ]
      }
    ]);

    expect(result).toContain('<flex-column [gap]="20">');
    expect(result).toContain('  <h2>{{organization.name}}</h2>');
    expect(result).toContain('  @if (loading) {');
    expect(result).toContain('    <mat-progress-bar mode="indeterminate"></mat-progress-bar>');
    expect(result).toContain('  @for (member of members; track member.id; let i = $index) {');
    expect(result).toContain('    <flex-row [gap]="12" [class.first]="i === 0">');
    expect(result).toContain('      <span>{{i + 1}}. {{member.name}}</span>');
    expect(result).toContain('      <button (click)="removeMember(member)" matTooltip="Remove">');
    expect(result).toContain('        <mat-icon>delete</mat-icon>');
    expect(result).toContain('  @empty {');
    expect(result).toContain('    <span>No members yet</span>');
    expect(result).toContain('  <apex-delete-button [object]="organization" afterDeleteRoute="/organizations"></apex-delete-button>');
  });
});

describe('extractTemplateRefs', () => {
  it('should only extract refs where referenceable is true', () => {
    const refs = extractTemplateRefs([
      { element: 'input', name: 'searchInput', referenceable: true },
      { element: 'dt-column', name: 'email' }
    ]);
    expect(refs).toEqual(new Set(['searchInput']));
  });

  it('should find refs nested in contains', () => {
    const refs = extractTemplateRefs({
      element: 'div',
      contains: [
        { element: 'input', name: 'nameField', referenceable: true },
        {
          if: 'showEmail',
          contains: [{ element: 'input', name: 'emailField', referenceable: true }]
        }
      ]
    });
    expect(refs).toEqual(new Set(['nameField', 'emailField']));
  });

  it('should find refs in for loops', () => {
    const refs = extractTemplateRefs({
      for: 'item',
      of: 'items',
      contains: [{ element: 'input', name: 'itemInputs', referenceable: true }]
    });
    expect(refs).toEqual(new Set(['itemInputs']));
  });

  it('should not include non-referenceable names', () => {
    const refs = extractTemplateRefs({
      element: 'div',
      contains: [
        { element: 'button', name: 'save', text: 'Save' },
        { element: 'button', name: 'cancel', text: 'Cancel' }
      ]
    });
    expect(refs.size).toBe(0);
  });
});
