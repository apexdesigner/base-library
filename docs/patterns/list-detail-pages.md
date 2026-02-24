# List + Detail Page Pair

The most common pattern is a list page showing all records and a detail page for viewing/editing a single record.

The list and detail pages follow a plural/singular naming convention — both for the class name and the path:

- **List page**: `SuppliersPage`, path `/suppliers` (plural)
- **Detail page**: `SupplierPage`, path `/suppliers/:supplier.id` (singular)

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
import { SuppliersPage } from "@pages";

@page({
  path: "/suppliers/:supplier.id",
  parentPage: SuppliersPage,
})
export class SupplierPage extends Page {

  @property({ read: "Automatically", save: "Automatically" })
  supplier!: SupplierFormGroup;
}

applyTemplate(SupplierPage, `
  <if condition="!supplier.reading">
    <flex-column>
      <h1>{{supplier.value.name}}</h1>
      <sf-fields [group]="supplier"></sf-fields>
    </flex-column>
    <else>
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    </else>
  </if>
`);
```

Key points:
- Type is `SupplierFormGroup` (singular name + `FormGroup`)
- `read: "Automatically"` reads the record by ID from the path parameter
- `save: "Automatically"` saves changes as the user edits
- Path parameter `:supplier.id` links the property name (`supplier`) to the URL parameter
- `parentPage` establishes navigation hierarchy (back button, breadcrumbs)
- `sf-fields [group]="supplier"` auto-renders form fields for all properties
- Access values via `supplier.value.name` (reactive form value access)

---

[← Back to Patterns](./README.md)
