# Component Interfaces

A component interface describes the template API of an Angular component that uses an element selector (e.g., `<mat-checkbox>`). Component interface files are named `<name>.component-interface.ts` and by default are created in `design/template-interfaces/`.

The component itself is authored in pure TypeScript — either in the app's source, a library, or an external package. The component interface is auto-generated from that source by the `@apexdesigner/extract-interfaces` module and regenerated on sync.

## Structure

A component interface file exports a class with a `@componentInterface()` decorator, typed properties for inputs, and `@output()` decorated properties for events.

```typescript
// mat-checkbox.component-interface.ts

import { componentInterface, output } from "@apexdesigner/dsl/component-interface";
import { MatCheckbox } from "@angular/material/checkbox";

@componentInterface({ selector: "mat-checkbox", acceptsChildren: true })
export class MatCheckboxComponentInterface {
  required!: boolean;
  checked!: any;
  disabled!: any;

  @output() change!: any;
  @output() indeterminateChange!: any;
}
```

## Decorator

The `@componentInterface()` decorator provides the element selector and whether the component accepts children.

```typescript
@componentInterface({ selector: "mat-checkbox", acceptsChildren: true })
```

- `selector` — the CSS element selector used in templates
- `acceptsChildren` — whether the component can contain child elements (optional, defaults to `false`)

## Import Statement

The non-framework import statement tells the code generator what to import in the Angular application:

```typescript
import { MatCheckbox } from "@angular/material/checkbox";
```

This replaces the JSON `imports` array. The validator extracts `{ name, from }` from the import.

## Properties (Inputs)

Properties represent the component's `@Input()` bindings. The type annotation maps to a base type:

- `string` — String
- `boolean` — Boolean
- `number` — Number
- `any` — Any (used when the type is complex or generic)

```typescript
export class MatCheckboxComponentInterface {
  /** Whether the checkbox is required. */
  required!: boolean;
  /** Whether the label should appear after or before. Defaults to 'after'. */
  labelPosition!: string;
  tabIndex!: number;
  checked!: any;
}
```

JSDoc comments on properties provide descriptions.

## Events (Outputs)

Events represent the component's `@Output()` bindings. They use the `@output()` decorator:

```typescript
export class MatCheckboxComponentInterface {
  // ...

  /** Event emitted when the checkbox's `checked` value changes. */
  @output() change!: any;
  @output() indeterminateChange!: any;
}
```

## Description

Use a JSDoc comment on the class to provide a description:

```typescript
/**
 * Checkbox component for toggling boolean values.
 */
@componentInterface({ selector: "mat-checkbox", acceptsChildren: true })
export class MatCheckboxComponentInterface {
  // ...
}
```

## Complete Example

```typescript
import { componentInterface, output } from "@apexdesigner/dsl/component-interface";
import { MatSelect } from "@angular/material/select";

/**
 * Component to select one or more options from a dropdown.
 */
@componentInterface({ selector: "mat-select", acceptsChildren: true })
export class MatSelectComponentInterface {
  "aria-describedby"!: string;
  /** Classes to be passed to the select panel. Supports the same syntax as `ngClass`. */
  panelClass!: any;
  /** Whether the select is disabled. */
  disabled!: boolean;
  /** Whether ripples in the select are disabled. */
  disableRipple!: boolean;
  /** Tab index of the select. */
  tabIndex!: number;
  placeholder!: any;
  required!: any;
  multiple!: any;
  /** Whether to center the active option over the trigger. */
  disableOptionCentering!: boolean;
  value!: any;
  "aria-label"!: string;
  "aria-labelledby"!: string;
  /** Time to wait in milliseconds after the last keystroke before moving focus to an item. */
  typeaheadDebounceInterval!: number;

  /** Event emitted when the select panel has been toggled. */
  @output() openedChange!: any;
  /** Event emitted when the select has been opened. */
  @output() opened!: any;
  /** Event emitted when the select has been closed. */
  @output() closed!: any;
  /** Event emitted when the selected value has been changed by the user. */
  @output() selectionChange!: any;
  /** Event that emits whenever the raw value of the select changes. */
  @output() valueChange!: any;
}
```
