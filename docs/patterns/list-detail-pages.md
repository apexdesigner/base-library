# List + Detail Page Pair

The most common pattern is a list page showing all records and a detail page for viewing/editing a single record.

The list and detail pages follow a plural/singular naming convention — both for the class name and the path:

- **List page**: `SuppliersPage`, path `/suppliers` (plural)
- **Detail page**: `SupplierPage`, path `/suppliers/:supplierFormGroup.id` (singular)

## List Page

```typescript
import { Page, page, property, applyTemplate } from "@apexdesigner/dsl/page";
import { SupplierPersistedArray } from "@business-objects-client";

@page({
  path: "/suppliers",
  sidenavIcon: "local_shipping",
})
export class SuppliersPage extends Page {

  @property({
    read: "Automatically",
    order: [{ field: "name", direction: "asc" }],
  })
  suppliers!: SupplierPersistedArray;
}

applyTemplate(SuppliersPage, [
  {
    "flex-column": [
      {
        element: "flex-row",
        attributes: { alignCenter: true },
        contains: [{ h1: "Suppliers" }],
      },
      {
        if: "!suppliers.reading",
        name: "loaded",
        contains: [
          {
            element: "dt-table",
            attributes: { dataSource: "<- suppliers", routerLinkTemplate: "/suppliers/{id}" },
            contains: [
              { element: "dt-column", name: "name", attributes: { property: "name", header: "Name" } },
              { element: "dt-column", name: "code", attributes: { property: "code", header: "Code" } },
            ],
          },
        ],
      },
      {
        if: "suppliers.reading",
        name: "loading",
        contains: [{ element: "mat-progress-bar", attributes: { mode: "indeterminate" } }],
      },
    ],
  },
]);
```

### Adding an Add Button

Use `add-button` to let users create new records directly from the list page:

```typescript
import { Page, page, property, applyTemplate } from "@apexdesigner/dsl/page";
import { SupplierPersistedArray } from "@business-objects-client";
import { AddButtonComponent } from "@components";

@page({
  path: "/suppliers",
  sidenavIcon: "local_shipping",
})
export class SuppliersPage extends Page {

  @property({
    read: "Automatically",
    order: [{ field: "name", direction: "asc" }],
  })
  suppliers!: SupplierPersistedArray;
}

applyTemplate(SuppliersPage, [
  {
    "flex-column": [
      {
        element: "flex-row",
        attributes: { alignCenter: true },
        contains: [
          { h1: "Suppliers" },
          { element: "div", attributes: { grow: null } },
          {
            element: "add-button",
            attributes: { array: "<- suppliers", added: "-> suppliers.read()" },
          },
        ],
      },
      {
        if: "!suppliers.reading",
        name: "loaded",
        contains: [
          {
            element: "dt-table",
            attributes: { dataSource: "<- suppliers", routerLinkTemplate: "/suppliers/{id}" },
            contains: [
              { element: "dt-column", name: "name", attributes: { property: "name", header: "Name" } },
              { element: "dt-column", name: "code", attributes: { property: "code", header: "Code" } },
            ],
          },
        ],
      },
      {
        if: "suppliers.reading",
        name: "loading",
        contains: [{ element: "mat-progress-bar", attributes: { mode: "indeterminate" } }],
      },
    ],
  },
]);
```

The add button automatically derives the dialog title from the entity name (e.g., "Add Supplier"). Optional inputs:
- `label` — custom button and dialog title
- `dialogWidth` — custom dialog width (default: `'400px'`)
- `added` — output event emitted with the newly added record

Key points:
- Type is `SupplierPersistedArray` (singular name + `PersistedArray`)
- `read: "Automatically"` fetches on page load
- `order` sorts the results
- `dt-table` with `routerLinkTemplate` creates clickable rows — `{id}` is replaced with each row's `id` value
- Use `if` blocks with names to show a progress bar while loading

## Detail Page

```typescript
import { Page, page, property, applyTemplate } from "@apexdesigner/dsl/page";
import { SupplierFormGroup } from "@business-objects-client";
import { Supplier } from "@business-objects-client";
import { SuppliersPage } from "@pages";

@page({
  path: "/suppliers/:supplierFormGroup.id",
  parentPage: SuppliersPage,
})
export class SupplierPage extends Page {

  @property({ read: "Automatically", save: "Automatically", afterReadCall: "afterRead" })
  supplierFormGroup!: SupplierFormGroup;

  supplier: Supplier = new Supplier();

  afterRead() {
    this.supplier = this.supplierFormGroup.object;
  }
}

applyTemplate(SupplierPage, [
  {
    if: "!supplierFormGroup.reading",
    name: "loaded",
    contains: [
      {
        "flex-column": [
          { h1: "{{supplier.name}}" },
          { element: "sf-fields", attributes: { group: "<- supplierFormGroup" } },
        ],
      },
    ],
  },
  {
    if: "supplierFormGroup.reading",
    name: "loading",
    contains: [{ element: "mat-progress-bar", attributes: { mode: "indeterminate" } }],
  },
]);
```

Key points:
- `supplierFormGroup` is the `SupplierFormGroup` used for form binding and persistence
- `supplier` is a typed `Supplier` BO instance for clean property access in the template
- `afterRead` updates `supplier` from `supplierFormGroup.object` after data is loaded
- `new Supplier()` initializes with no data (constructor parameter is optional)
- Use `supplier.name` instead of `supplierFormGroup.value.name` for cleaner template expressions
- `sf-fields` with `group: "<- supplierFormGroup"` binds to the form group for editing
- Path parameter `:supplierFormGroup.id` links the form group property to the URL parameter
- `parentPage` establishes navigation hierarchy (back button, breadcrumbs)

---

[← Back to Patterns](./README.md)
