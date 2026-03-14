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

applyTemplate(SuppliersPage, `
  <flex-column>
    <flex-row [alignCenter]="true">
      <h1>Suppliers</h1>
    </flex-row>
    <if condition="!suppliers.reading">
      <dt-table [dataSource]="suppliers" routerLinkTemplate="/suppliers/{id}">
        <dt-column property="name" header="Name"></dt-column>
        <dt-column property="code" header="Code"></dt-column>
      </dt-table>
      <else>
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </else>
    </if>
  </flex-column>
`);
```

### Adding an Add Button

Use `<add-button>` to let users create new records directly from the list page:

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

applyTemplate(SuppliersPage, `
  <flex-column>
    <flex-row [alignCenter]="true">
      <h1 grow>Suppliers</h1>
      <add-button [array]="suppliers" (added)="suppliers.read()"></add-button>
    </flex-row>
    <if condition="!suppliers.reading">
      <dt-table [dataSource]="suppliers" routerLinkTemplate="/suppliers/{id}">
        <dt-column property="name" header="Name"></dt-column>
        <dt-column property="code" header="Code"></dt-column>
      </dt-table>
      <else>
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </else>
    </if>
  </flex-column>
`);
```

The add button automatically derives the dialog title from the entity name (e.g., "Add Supplier"). Optional inputs:
- `label` — custom button and dialog title
- `dialogWidth` — custom dialog width (default: `'400px'`)
- `(added)` — event emitted with the newly added record

Key points:
- Type is `SupplierPersistedArray` (singular name + `PersistedArray`)
- `read: "Automatically"` fetches on page load
- `order` sorts the results
- `dt-table` with `routerLinkTemplate` creates clickable rows — `{id}` is replaced with each row's `id` value
- `.reading` is `true` while data is being fetched — wrap content in `<if condition="!suppliers.reading">` with `<mat-progress-bar>` in the `<else>` to prevent rendering errors from undefined data

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

  @property({ read: "Automatically", save: "Automatically", afterRead: "afterRead" })
  supplierFormGroup!: SupplierFormGroup;

  supplier: Supplier = new Supplier();

  afterRead() {
    this.supplier = this.supplierFormGroup.object;
  }
}

applyTemplate(SupplierPage, `
  <if condition="!supplierFormGroup.reading">
    <flex-column>
      <h1>{{supplier.name}}</h1>
      <sf-fields [group]="supplierFormGroup"></sf-fields>
    </flex-column>
    <else>
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    </else>
  </if>
`);
```

Key points:
- `supplierFormGroup` is the `SupplierFormGroup` used for form binding and persistence
- `supplier` is a typed `Supplier` BO instance for clean property access in the template
- `afterRead` updates `supplier` from `supplierFormGroup.object` after data is loaded
- `new Supplier()` initializes with no data (constructor parameter is optional)
- Use `supplier.name` instead of `supplierFormGroup.value.name` for cleaner template expressions
- `sf-fields [group]="supplierFormGroup"` binds to the form group for editing
- Path parameter `:supplierFormGroup.id` links the form group property to the URL parameter
- `parentPage` establishes navigation hierarchy (back button, breadcrumbs)

---

[← Back to Patterns](./README.md)
