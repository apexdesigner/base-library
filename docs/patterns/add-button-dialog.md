# Add Button + Dialog Component

## Overview

A reusable add-button component that accepts a `PersistedArray` as an input. When clicked, it opens a dialog that creates a new record using a form driven by the corresponding `FormGroup`.

## Design

### Components

- **AddButton component** — accepts a `PersistedArray` input, renders a button, opens an AddDialog on click
- **AddDialog component** (`isDialog: true`) — accepts the same `PersistedArray` input, creates a `FormGroup` from it, renders schema-driven form fields, and saves on submit

### Key Problem: Getting the FormGroup from a PersistedArray

The add-button receives a generic `PersistedArray` at runtime. To render a form, it needs the corresponding `FormGroup` class (e.g., `FooPersistedArray` → `FooFormGroup`).

**Solution:** Add a `createFormGroup()` factory method to each generated `PersistedArray` subclass. Since `business-object-form-group.generator.ts` already generates both classes in the same file, it has all the information needed.

Generated output becomes:

```typescript
export class FooPersistedArray extends PersistedArray<Foo> {
  constructor(options?: PersistedArrayOptions) {
    super(Foo, options);
  }

  createFormGroup(options?: PersistedFormGroupOptions): FooFormGroup {
    return new FooFormGroup(options);
  }
}
```

The base `PersistedArray` class gets a `createFormGroup()` method (returns `PersistedFormGroup`) so the add-button component can call it generically.

### Save Flow

TBD — options:
- `formGroup.save()` then re-read the array
- `persistedArray.add(formGroup.value)`

### Open Questions

- Form fields: auto-rendered from schema via `schema-forms`, or custom template via content projection?
- Button appearance: icon button, text button, FAB?
- Customization: configurable label/icon?

## Files to Change

1. `generators/client/persisted-form-group.generator.ts` — add `createFormGroup()` to base `PersistedArray` class
2. `generators/client/business-object-form-group.generator.ts` — generate `createFormGroup()` on each `PersistedArray` subclass
3. `generators/@types/business-object-form-group-type.generator.ts` — add `createFormGroup()` to type definitions
4. New design components: `add-button.component.ts`, `add-dialog.component.ts`
