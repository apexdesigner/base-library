# Directive Interfaces

A directive interface describes the template API of an Angular directive that uses an attribute selector (e.g., `[matTooltip]`). Directive interface files are named `<name>.directive-interface.ts` and by default are created in `design/template-interfaces/`.

The directive itself is authored in pure TypeScript — either in the app's source, a library, or an external package. The directive interface is auto-generated from that source by the `@apexdesigner/extract-interfaces` module and regenerated on sync.

## Structure

A directive interface file exports a class with a `@directiveInterface()` decorator, typed properties for inputs, and `@output()` decorated properties for events.

```typescript
// mat-tooltip.directive-interface.ts

import { directiveInterface } from "@apexdesigner/dsl/directive-interface";
import { MatTooltip } from "@angular/material/tooltip";

@directiveInterface({ selector: "[matTooltip]" })
export class MatTooltipDirectiveInterface {
  matTooltip!: any;
  matTooltipPosition!: any;
  matTooltipDisabled!: any;
}
```

## Decorator

The `@directiveInterface()` decorator provides the attribute selector.

```typescript
@directiveInterface({ selector: "[matTooltip]" })
```

- `selector` — the CSS attribute selector used in templates

## Import Statement

The non-framework import statement tells the code generator what to import in the Angular application:

```typescript
import { MatTooltip } from "@angular/material/tooltip";
```

For non-standalone directives that must be imported via their NgModule, the import references the module:

```typescript
import { FormsModule } from "@angular/forms";

@directiveInterface({ selector: "[ngModel]" })
export class NgModelDirectiveInterface {
  ngModel!: any;
  @output() ngModelChange!: any;
}
```

## Properties (Inputs)

Properties represent the directive's `@Input()` bindings. Types map to base types the same way as [component interfaces](component-interfaces.md#properties-inputs).

```typescript
export class MatTooltipDirectiveInterface {
  matTooltipPosition!: any;
  /** How touch gestures should be handled by the tooltip. */
  matTooltipTouchGestures!: string;
  matTooltipShowDelay!: any;
  matTooltipHideDelay!: any;
}
```

## Events (Outputs)

Events use the `@output()` decorator, the same as [component interfaces](component-interfaces.md#events-outputs).

```typescript
export class NgModelDirectiveInterface {
  ngModel!: any;
  @output() ngModelChange!: any;
}
```

## Description

Use a JSDoc comment on the class to provide a description:

```typescript
/**
 * Directive that attaches a material design tooltip to the host element.
 * Animates the showing and hiding of a tooltip provided position (defaults to below the element).
 */
@directiveInterface({ selector: "[matTooltip]" })
export class MatTooltipDirectiveInterface {
  // ...
}
```

## Complete Example

```typescript
import { directiveInterface, output } from "@apexdesigner/dsl/directive-interface";
import { MatAutocompleteTrigger } from "@angular/material/autocomplete";

/**
 * Base class with all of the `MatAutocompleteTrigger` functionality.
 */
@directiveInterface({ selector: "input[matAutocomplete],textarea[matAutocomplete]" })
export class MatAutocompleteTriggerDirectiveInterface {
  /** The autocomplete panel to be attached to this trigger. */
  matAutocomplete!: any;
  /** Position of the autocomplete panel relative to the trigger element. */
  matAutocompletePosition!: string;
  /** Reference relative to which to position the autocomplete panel. */
  matAutocompleteConnectedTo!: any;
  /** `autocomplete` attribute to be set on the input element. */
  autocomplete!: string;
  /** Whether the autocomplete is disabled. */
  matAutocompleteDisabled!: boolean;
}
```
