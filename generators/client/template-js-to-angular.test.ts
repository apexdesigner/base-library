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
      'flex-row': [
        { span: '{{member.name}}' },
        { 'mat-icon': 'delete' },
      ],
    });
    expect(result).toContain('<flex-row>');
    expect(result).toContain('  <span>{{member.name}}</span>');
    expect(result).toContain('  <mat-icon>delete</mat-icon>');
    expect(result).toContain('</flex-row>');
  });

  it('should convert expression bindings (= prefix)', () => {
    const result = convertJsTemplateToAngular({
      element: 'flex-row',
      gap: '= 20',
    });
    expect(result).toContain('[gap]="20"');
  });

  it('should convert event bindings (-> prefix)', () => {
    const result = convertJsTemplateToAngular({
      element: 'button',
      text: 'Save',
      click: '-> save()',
    });
    expect(result).toContain('(click)="save()"');
    expect(result).toContain('Save');
  });

  it('should convert static attributes', () => {
    const result = convertJsTemplateToAngular({
      element: 'mat-progress-bar',
      mode: 'indeterminate',
    });
    expect(result).toContain('mode="indeterminate"');
  });

  it('should convert class and style bindings', () => {
    const result = convertJsTemplateToAngular({
      element: 'div',
      'class.active': '= isActive',
      'style.width.px': '= columnWidth',
    });
    expect(result).toContain('[class.active]="isActive"');
    expect(result).toContain('[style.width.px]="columnWidth"');
  });

  it('should convert template references via name', () => {
    const result = convertJsTemplateToAngular({
      element: 'input',
      name: 'searchInput',
      type: 'text',
    });
    expect(result).toContain('#searchInput');
    expect(result).toContain('type="text"');
  });

  it('should convert @if', () => {
    const result = convertJsTemplateToAngular({
      if: 'user.isActive',
      contains: [{ element: 'div', text: 'User is active' }],
    });
    expect(result).toContain('@if (user.isActive) {');
    expect(result).toContain('  <div>User is active</div>');
    expect(result).toContain('}');
  });

  it('should convert @if with else', () => {
    const result = convertJsTemplateToAngular({
      if: 'user.isActive',
      contains: [{ element: 'div', text: 'Active' }],
      elseContains: [{ element: 'div', text: 'Inactive' }],
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
          elseContains: [{ element: 'div', text: 'Unknown' }],
        },
      ],
    });
    expect(result).toContain("@if (status === 'active') {");
    expect(result).toContain("} @else @if (status === 'pending') {");
    expect(result).toContain('} @else {');
    expect(result).toContain('  <div>Unknown</div>');
  });

  it('should convert @for with track', () => {
    const result = convertJsTemplateToAngular({
      for: 'item',
      of: 'items',
      trackBy: 'item.id',
      contains: [{ element: 'div', text: '{{item.name}}' }],
    });
    expect(result).toContain('@for (item of items; track item.id) {');
    expect(result).toContain('  <div>{{item.name}}</div>');
    expect(result).toContain('}');
  });

  it('should convert @for with default track $index', () => {
    const result = convertJsTemplateToAngular({
      for: 'item',
      of: 'items',
      contains: [{ element: 'div', text: '{{item.name}}' }],
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
      contains: [{ element: 'div', text: '{{item.name}}' }],
    });
    expect(result).toContain('let i = $index, isFirst = $first, isLast = $last');
  });

  it('should convert @for with @empty', () => {
    const result = convertJsTemplateToAngular({
      for: 'item',
      of: 'items',
      contains: [{ element: 'div', text: '{{item.name}}' }],
      emptyContains: [{ element: 'div', text: 'No items' }],
    });
    expect(result).toContain('@empty {');
    expect(result).toContain('  <div>No items</div>');
  });

  it('should convert @switch with value cases', () => {
    const result = convertJsTemplateToAngular({
      switch: 'status',
      cases: {
        active: [{ element: 'div', text: 'Active' }],
        pending: [{ element: 'div', text: 'Pending' }],
      },
      otherwiseContains: [{ element: 'div', text: 'Unknown' }],
    });
    expect(result).toContain("@switch (status) {");
    expect(result).toContain("  @case ('active') {");
    expect(result).toContain("  @case ('pending') {");
    expect(result).toContain('  @default {');
  });

  it('should convert @switch with expression cases', () => {
    const result = convertJsTemplateToAngular({
      switch: 'score',
      cases: [
        { case: 'score > 90', contains: [{ element: 'div', text: 'Excellent' }] },
        { case: 'score > 70', contains: [{ element: 'div', text: 'Good' }] },
      ],
    });
    expect(result).toContain('@case (score > 90) {');
    expect(result).toContain('@case (score > 70) {');
  });

  it('should handle attribute.name collision escape', () => {
    const result = convertJsTemplateToAngular({
      element: 'user-badge',
      name: 'badge',
      'attribute.name': '= user.displayName',
    });
    expect(result).toContain('#badge');
    expect(result).toContain('[name]="user.displayName"');
  });

  it('should convert numeric attribute values as bindings', () => {
    const result = convertJsTemplateToAngular({
      element: 'flex-column',
      gap: '= 20',
    });
    expect(result).toContain('[gap]="20"');
  });

  it('should handle the full example from the design doc', () => {
    const result = convertJsTemplateToAngular([
      {
        element: 'flex-column',
        gap: '= 20',
        contains: [
          { h2: '{{organization.name}}' },
          {
            if: 'loading',
            contains: [{ element: 'mat-progress-bar', mode: 'indeterminate' }],
          },
          {
            for: 'member',
            of: 'members',
            trackBy: 'member.id',
            index: 'i',
            contains: [
              {
                element: 'flex-row',
                gap: '= 12',
                'class.first': '= i === 0',
                contains: [
                  { span: '{{i + 1}}. {{member.name}}' },
                  {
                    element: 'button',
                    click: '-> removeMember(member)',
                    matTooltip: 'Remove',
                    contains: [{ 'mat-icon': 'delete' }],
                  },
                ],
              },
            ],
            emptyContains: [{ span: 'No members yet' }],
          },
          {
            element: 'apex-delete-button',
            object: '= organization',
            afterDeleteRoute: '/organizations',
          },
        ],
      },
    ]);

    // Check key parts of the output
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
  it('should extract name values as template refs', () => {
    const refs = extractTemplateRefs([
      { element: 'input', name: 'searchInput', type: 'text' },
      { element: 'button', text: 'Focus' },
    ]);
    expect(refs).toEqual(new Set(['searchInput']));
  });

  it('should find refs nested in contains', () => {
    const refs = extractTemplateRefs({
      element: 'div',
      contains: [
        { element: 'input', name: 'nameField' },
        {
          if: 'showEmail',
          contains: [{ element: 'input', name: 'emailField' }],
        },
      ],
    });
    expect(refs).toEqual(new Set(['nameField', 'emailField']));
  });

  it('should find refs in for loops', () => {
    const refs = extractTemplateRefs({
      for: 'item',
      of: 'items',
      contains: [{ element: 'input', name: 'itemInputs' }],
    });
    expect(refs).toEqual(new Set(['itemInputs']));
  });
});
