# Generated Types

When a business object is defined in the DSL, the generators produce several typed classes for use in pages and components. For a business object named `Supplier`:

## Client Types (import from `@business-objects-client`)

- **`SupplierFormGroup`** — A reactive form group for a single record. Use on detail pages for viewing/editing.
- **`SupplierPersistedArray`** — A reactive array backed by the API. Use on list pages for displaying collections.
- **`SupplierFormArray`** — A reactive form array for editing collections inline (e.g., child records on a parent detail page).

## Server Types (import from `@business-objects`)

- **`Supplier`** — The server-side model class. Use in app behaviors and server-side logic.
  - Static methods: `Supplier.find()`, `Supplier.findById()`, `Supplier.count()`, `Supplier.create()`, `Supplier.createMany()`
  - Instance methods: `supplier.save()`, `supplier.delete()`

---

[← Back to Patterns](./README.md)
