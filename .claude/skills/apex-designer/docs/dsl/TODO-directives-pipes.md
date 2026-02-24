# TODO: Directive and Pipe Entity Types

## Summary

Create two new design types — Directive and Pipe — following existing patterns from Component, Page, and Service. Both support app-authored (no `from`) and library-described (`from` in decorator) variants, unifying the current "template interface" JSON files into the same class-based pattern.

## Directive

- **Class**: `extends Directive` from `@apexdesigner/dsl/directive`
- **Decorator**: `@directive({ selector: "[attributeName]" })` — required since attribute selectors aren't derivable from class name
- **Properties**: same `@property()` pattern — `isInput`, `isOutput` for inputs/outputs
- **Events**: `@property({ isOutput: true })` for event emitters
- **Methods**: same `@method()` pattern for lifecycle hooks
- **Service injection**: same pattern (no decorator)
- **No template**: directives modify existing elements, no `applyTemplate()`
- **Library-described**: `@directive({ selector: "...", from: "@angular/material/button" })` — `from` indicates an external directive
- **File location**: `design/directives/<name>.directive.ts`

### App-authored example

```typescript
import { Directive, directive, property } from "@apexdesigner/dsl/directive";

@directive({ selector: "[highlight]" })
export class HighlightDirective extends Directive {
  @property({ isInput: true })
  highlight: string;

  @property({ isInput: true })
  highlightColor: string;
}
```

### Library-described example

```typescript
import { Directive, directive } from "@apexdesigner/dsl/directive";

@directive({ selector: "button[mat-button],button[mat-flat-button]", from: "@angular/material/button" })
export class MatButton extends Directive {
}
```

## Pipe

- **Class**: `extends Pipe` from `@apexdesigner/dsl/pipe`
- **Decorator**: `@pipe({ selector: "pipeName" })` — required since the template pipe name isn't derivable from class name
- **Transform method**: the core `transform()` method with typed parameters
- **Service injection**: same pattern
- **No template**: pipes are pure transformations
- **Library-described**: `@pipe({ selector: "async", from: "@angular/common" })` — external pipe
- **File location**: `design/pipes/<name>.pipe.ts`

### App-authored example

```typescript
import { Pipe, pipe } from "@apexdesigner/dsl/pipe";

@pipe({ selector: "initials" })
export class InitialsPipe extends Pipe {
  transform(value: string): string {
    return value
      .split(" ")
      .map((word) => word[0])
      .join("");
  }
}
```

### Library-described example

```typescript
import { Pipe, pipe } from "@apexdesigner/dsl/pipe";

@pipe({ selector: "async", from: "@angular/common" })
export class AsyncPipe extends Pipe {
}
```

## Key Design Decision

The `from` field in the decorator is the only structural difference between app-authored and library-described items. This applies to components, directives, and pipes — eliminating the need for separate ElementInterface, DirectiveInterface, and PipeInterface types.

## When Implementing

- Create `docs/directives.md` and `docs/pipes.md`
- Create example design files
- Update `docs/README.md` and `README.md` with links
- Update `docs/templates.md` with links to new docs
