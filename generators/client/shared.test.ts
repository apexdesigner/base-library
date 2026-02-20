import { describe, it, expect } from 'vitest';
import {
  parseTemplateHtml,
  extractElementSelectors,
  extractDirectiveSelectors,
  extractPipeNames,
  matchesDirectiveSelector,
  convertAd3Template,
} from './shared';

describe('parseTemplateHtml', () => {
  it('should extract element tag names', () => {
    const html = '<mat-icon>test</mat-icon><button>click</button>';
    const result = parseTemplateHtml(html);

    expect(result.elements.has('mat-icon')).toBe(true);
    expect(result.elements.has('button')).toBe(true);
  });

  it('should extract attribute names with case preserved', () => {
    const html = '<button mat-icon-button matTooltip="Delete">click</button>';
    const result = parseTemplateHtml(html);

    expect(result.attributes.has('mat-icon-button')).toBe(true);
    expect(result.attributes.has('matTooltip')).toBe(true);
  });

  it('should extract bracket notation attributes without brackets', () => {
    const html = '<input [disabled]="isDisabled" [formControl]="control">';
    const result = parseTemplateHtml(html);

    expect(result.attributes.has('disabled')).toBe(true);
    expect(result.attributes.has('formControl')).toBe(true);
  });

  it('should extract structural directive names without asterisk', () => {
    const html = '<div *ngIf="condition" *ngFor="let item of items">test</div>';
    const result = parseTemplateHtml(html);

    expect(result.attributes.has('ngIf')).toBe(true);
    expect(result.attributes.has('ngFor')).toBe(true);
  });

  it('should NOT extract property accesses inside attribute values', () => {
    const html = '<button [disabled]="disabled || object.formGroup?.disabled">click</button>';
    const result = parseTemplateHtml(html);

    expect(result.attributes.has('disabled')).toBe(true);
    expect(result.attributes.has('formGroup')).toBe(false);
    expect(result.attributes.has('formgroup')).toBe(false);
  });

  it('should extract banana-in-box notation without brackets', () => {
    const html = '<input [(ngModel)]="value">';
    const result = parseTemplateHtml(html);

    expect(result.attributes.has('ngModel')).toBe(true);
  });
});

describe('extractElementSelectors', () => {
  it('should return non-standard HTML elements', () => {
    const html = '<mat-icon>test</mat-icon><div>content</div><mat-button>click</mat-button>';
    const result = extractElementSelectors(html);

    expect(result.has('mat-icon')).toBe(true);
    expect(result.has('mat-button')).toBe(true);
    expect(result.has('div')).toBe(false);
  });

  it('should exclude standard HTML elements', () => {
    const html = '<div><span><p><button><input><form><table></table></form></button></p></span></div>';
    const result = extractElementSelectors(html);

    expect(result.size).toBe(0);
  });

  it('should detect router-outlet as a non-standard element', () => {
    const html = '<router-outlet></router-outlet>';
    const result = extractElementSelectors(html);

    expect(result.has('router-outlet')).toBe(true);
  });
});

describe('extractDirectiveSelectors', () => {
  it('should return directive attributes with case preserved', () => {
    const html = '<button mat-icon-button matTooltip="test">click</button>';
    const result = extractDirectiveSelectors(html);

    expect(result.has('mat-icon-button')).toBe(true);
    expect(result.has('matTooltip')).toBe(true);
  });

  it('should exclude standard HTML attributes', () => {
    const html = '<input type="text" name="field" class="input" id="myInput" disabled>';
    const result = extractDirectiveSelectors(html);

    expect(result.has('type')).toBe(false);
    expect(result.has('name')).toBe(false);
    expect(result.has('class')).toBe(false);
    expect(result.has('id')).toBe(false);
    expect(result.has('disabled')).toBe(false);
  });

  it('should exclude data-* and aria-* attributes', () => {
    const html = '<button data-test="value" aria-label="label">click</button>';
    const result = extractDirectiveSelectors(html);

    expect(result.has('data-test')).toBe(false);
    expect(result.has('aria-label')).toBe(false);
  });

  it('should NOT include property accesses from attribute values', () => {
    const html = '<button [disabled]="disabled || object.formGroup?.disabled">click</button>';
    const result = extractDirectiveSelectors(html);

    expect(result.has('formGroup')).toBe(false);
    expect(result.has('formgroup')).toBe(false);
  });

  it('should include formGroup when used as an actual directive attribute', () => {
    const html = '<form [formGroup]="myForm"><input formControlName="field"></form>';
    const result = extractDirectiveSelectors(html);

    expect(result.has('formGroup')).toBe(true);
    expect(result.has('formControlName')).toBe(true);
  });
});

describe('matchesDirectiveSelector', () => {
  it('should match simple bracket selector [attr]', () => {
    const elements = new Set(['div', 'button']);
    const result = matchesDirectiveSelector('[matTooltip]', 'matTooltip', elements);
    expect(result).toBe(true);
  });

  it('should match simple attribute selector without brackets', () => {
    const elements = new Set(['div', 'button']);
    const result = matchesDirectiveSelector('mat-button', 'mat-button', elements);
    expect(result).toBe(true);
  });

  it('should match compound selector element[attr] when element exists', () => {
    const elements = new Set(['input', 'div']);
    const result = matchesDirectiveSelector('input[matAutocomplete]', 'matAutocomplete', elements);
    expect(result).toBe(true);
  });

  it('should NOT match compound selector element[attr] when element does not exist', () => {
    const elements = new Set(['div', 'button']);
    const result = matchesDirectiveSelector('input[matAutocomplete]', 'matAutocomplete', elements);
    expect(result).toBe(false);
  });

  it('should match compound selector with hyphenated element', () => {
    const elements = new Set(['mat-form-field', 'input']);
    const result = matchesDirectiveSelector('mat-form-field[appearance]', 'appearance', elements);
    expect(result).toBe(true);
  });

  it('should NOT match when attribute name does not match', () => {
    const elements = new Set(['input']);
    const result = matchesDirectiveSelector('input[matAutocomplete]', 'formControl', elements);
    expect(result).toBe(false);
  });

  it('should match selector with :not() suffix', () => {
    const elements = new Set(['input', 'div']);
    const result = matchesDirectiveSelector('[ngModel]:not([formControlName]):not([formControl])', 'ngModel', elements);
    expect(result).toBe(true);
  });

  it('should match compound selector with :not() suffix', () => {
    const elements = new Set(['input', 'textarea']);
    const result = matchesDirectiveSelector('input[matInput]:not([disabled])', 'matInput', elements);
    expect(result).toBe(true);
  });

  it('should match multi-attribute selector when all attributes present', () => {
    const elements = new Set(['button']);
    const allAttributes = new Set(['confirm', 'confirmMessage']);
    const result = matchesDirectiveSelector('[confirm][confirmMessage]', 'confirm', elements, allAttributes);
    expect(result).toBe(true);
  });

  it('should match multi-attribute selector for second attribute', () => {
    const elements = new Set(['button']);
    const allAttributes = new Set(['confirm', 'confirmMessage']);
    const result = matchesDirectiveSelector('[confirm][confirmMessage]', 'confirmMessage', elements, allAttributes);
    expect(result).toBe(true);
  });

  it('should NOT match multi-attribute selector when attribute missing', () => {
    const elements = new Set(['button']);
    const allAttributes = new Set(['confirmMessage']);
    const result = matchesDirectiveSelector('[confirm][confirmMessage]', 'confirmMessage', elements, allAttributes);
    expect(result).toBe(false);
  });
});

describe('extractPipeNames', () => {
  it('should extract pipe from interpolation', () => {
    const html = '{{ value | async }}';
    const result = extractPipeNames(html);
    expect(result.has('async')).toBe(true);
  });

  it('should extract pipe from property binding', () => {
    const html = '<div [class]="items | json"></div>';
    const result = extractPipeNames(html);
    expect(result.has('json')).toBe(true);
  });

  it('should extract multiple pipes', () => {
    const html = '{{ value | async }} {{ date | date }} <div [value]="x | uppercase"></div>';
    const result = extractPipeNames(html);
    expect(result.has('async')).toBe(true);
    expect(result.has('date')).toBe(true);
    expect(result.has('uppercase')).toBe(true);
  });

  it('should NOT extract pipe-like patterns in regular text', () => {
    const html = '<div>This is not a | pipe</div>';
    const result = extractPipeNames(html);
    expect(result.has('pipe')).toBe(false);
  });

  it('should extract pipe from condition attribute', () => {
    const html = '<if condition="(authService.authenticated | async) === false"><div>content</div></if>';
    const result = extractPipeNames(html);
    expect(result.has('async')).toBe(true);
  });

  it('should extract pipe from of attribute', () => {
    const html = '<for const="item" of="items | async"><div>{{ item }}</div></for>';
    const result = extractPipeNames(html);
    expect(result.has('async')).toBe(true);
  });
});

describe('convertAd3Template', () => {
  it('should convert <if> to @if', () => {
    const result = convertAd3Template('<if condition="show"><div>hello</div></if>');
    expect(result).toBe('@if (show) {<div>hello</div>}');
  });

  it('should convert <else> to @else', () => {
    const result = convertAd3Template('<if condition="show"><div>yes</div></if><else><div>no</div></else>');
    expect(result).toBe('@if (show) {<div>yes</div>}} @else {<div>no</div>');
  });

  it('should convert <for> to @for with default track', () => {
    const result = convertAd3Template('<for const="item" of="items"><div>{{ item }}</div></for>');
    expect(result).toBe('@for (item of items; track $index) {<div>{{ item }}</div>}');
  });

  it('should convert <for> with trackBy', () => {
    const result = convertAd3Template('<for const="item" of="items" trackBy="item.id"><div>{{ item }}</div></for>');
    expect(result).toBe('@for (item of items; track item.id) {<div>{{ item }}</div>}');
  });

  it('should return empty string for empty input', () => {
    expect(convertAd3Template('')).toBe('');
  });

  it('should pass through plain HTML unchanged', () => {
    const html = '<div class="wrapper"><h1>Hello</h1></div>';
    expect(convertAd3Template(html)).toBe(html);
  });
});
