# Library Development

Guide for developing Apex Designer libraries — reusable packages of design assets consumed by other projects.

## Project Setup

Set `isLibrary = true` in your `design/project.ts` to mark the project as a library:

```typescript
export class MyLibrary extends Project {
  displayName = "My Library";
  isLibrary = true;
  // ...
}
```

This flag changes how the project is treated during code generation and packaging.

## Test Design Items

Libraries often need test design items (business objects, pages, components, etc.) to verify the library works correctly during development. These should not be included in the published npm package.

### Pattern

1. Place all test design items in a `design/testing/` directory:

```
design/
  testing/
    test-item/
      test-item.business-object.ts
      test-item.process.behavior.ts
    test-category/
      test-category.business-object.ts
    test-dialog.component.ts
    test-postgres.data-source.ts
    test.page.ts
  project.ts
  ...
```

2. Add a `.npmignore` file at the project root to exclude them from the package:

```
design/testing/
```

This way test items are available during development (for `ad3 resolve`, `ad3 gen`, and running the dev server) but are not shipped to consumers of the library.
