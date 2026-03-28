# Dialog Components

Dialog components are modal windows opened programmatically. They use Angular Material's `MatDialog` service under the hood.

Set `isDialog: true` in the `@component` decorator to mark a component as a dialog. The generator produces two Angular components from one design file:

- **Wrapper component** (keeps the original class name) — template-less, has `open()` and `close()` methods
- **Content component** (class name with `Content` suffix) — contains the template, styles, and logic

## Design File

```typescript
import { Component, component, property, applyTemplate } from "@apexdesigner/dsl/component";
import { MatDialogRef } from "@angular/material/dialog";
import { EventEmitter } from "@angular/core";

@component({ isDialog: true })
export class AddPropertyDialogComponent extends Component {

  @property({ isInput: true })
  title!: string;

  @property({ isOutput: true })
  saved!: EventEmitter<void>;

  dialog!: MatDialogRef<any>;

  cancel() {
    this.dialog.close();
  }

  save() {
    this.saved.emit();
    this.dialog.close();
  }
}

applyTemplate(AddPropertyDialogComponent, [
  { "mat-dialog-content": [{ element: "p", text: "Dialog content here" }] },
  {
    "mat-dialog-actions": [
      {
        element: "button",
        name: "cancelButton",
        text: "Cancel",
        attributes: { "mat-button": null, click: "-> cancel()" },
      },
      {
        element: "button",
        name: "saveButton",
        text: "Save",
        attributes: { "mat-button": null, click: "-> save()" },
      },
    ],
  },
]);
```

Key points:
- `isDialog: true` triggers dialog generation
- `@property({ isInput: true })` — data passed into the dialog
- `@property({ isOutput: true })` — events emitted back to the parent; type as `EventEmitter<void>` (or `EventEmitter<T>` for a payload)
- `dialog!: MatDialogRef<any>` — declare this property to get access to the dialog reference for programmatic close
- Use `mat-dialog-content` and `mat-dialog-actions` as element shorthand keys in the template

## Using a Dialog from a Page or Component

Place the dialog component in the template using its selector. Use `referenceable: true` and a `name` to get a handle. Call `open()` to show it:

```typescript
import { Page, page, applyTemplate } from "@apexdesigner/dsl/page";
import { AddPropertyDialogComponent } from "@components";

@page({ path: "/properties" })
export class PropertiesPage extends Page {

  addPropertyDialog!: AddPropertyDialogComponent;

  onSaved() {
    console.log("saved");
  }
}

applyTemplate(PropertiesPage, [
  {
    "flex-column": [
      {
        element: "add-property-dialog",
        name: "addPropertyDialog",
        referenceable: true,
        attributes: { title: "<- 'Add Property'", saved: "-> onSaved()" },
      },
      {
        element: "button",
        text: "Add Property",
        attributes: { "mat-button": null, click: "-> addPropertyDialog.open()" },
      },
    ],
  },
]);
```

Key points:
- Add the dialog to the template using its selector (`add-property-dialog`)
- Use `name` and `referenceable: true` to get a handle — the name must match the class property
- Bind inputs with `<-` prefix: `title: "<- 'Add Property'"`
- Bind outputs with `->` prefix: `saved: "-> onSaved()"`
- Call `addPropertyDialog.open()` via a button click to show the dialog

## Dialog Options

The wrapper accepts an `options` input of type `MatDialogConfig` for controlling dialog behavior:

```typescript
{
  element: "add-property-dialog",
  name: "addPropertyDialog",
  referenceable: true,
  attributes: {
    title: "<- 'Add Property'",
    options: "<- { width: '600px', disableClose: true }",
    saved: "-> onSaved()",
  },
}
```

Default options: `{ autoFocus: true }`.

## Opening a Dialog Programmatically (without the wrapper element)

The wrapper element approach works when a component has a template where the dialog can be placed. But directives and services don't have templates. For these cases, use the wrapper's static `contentComponent` property with `MatDialog`:

```typescript
import { Directive, directive, property, method } from "@apexdesigner/dsl/directive";
import { MatDialog } from "@angular/material/dialog";
import { ConfirmationDialogComponent } from "@components";

@directive({ selector: "[confirm][confirmMessage]" })
export class ConfirmDirective extends Directive {

  @property({ isInput: true })
  confirmMessage!: string;

  matDialog!: MatDialog;

  @method({ callOnEvent: "click" })
  async onClick(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const dialogRef = this.matDialog.open(ConfirmationDialogComponent.contentComponent);
    const instance: any = dialogRef.componentInstance;
    instance.message = this.confirmMessage;

    instance.confirmed.subscribe(() => {
      dialogRef.close();
    });
  }
}
```

Key points:
- Import the dialog **wrapper** class from `@components` (not the content component)
- Access `WrapperClass.contentComponent` — a static property on the wrapper that references the content component class
- Pass the content component to `MatDialog.open()`
- Set inputs and subscribe to outputs on `dialogRef.componentInstance`
- The generator adds `static contentComponent` to all dialog wrappers automatically

This pattern is used by the `ConfirmDirective` to open a confirmation dialog on click.

## What Gets Generated

For a design file named `AddPropertyDialogComponent`:

| File | Contains |
|---|---|
| `add-property-dialog.component.ts` | Wrapper: `AddPropertyDialogComponent` with `open()`, `close()`, input/output forwarding |
| `add-property-dialog-content.component.ts` | Content: `AddPropertyDialogContentComponent` with template, styles, logic, `MatDialogRef` |
| `add-property-dialog.component.html` | Template (used by content component) |
| `add-property-dialog.component.scss` | Styles (used by content component) |

---

[← Back to Patterns](./README.md)
