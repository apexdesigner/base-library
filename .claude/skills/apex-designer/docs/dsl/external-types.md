# External Types

An external type represents an importable type from a library dependency. External type files are named `<name>.external-type.ts` and by default are created in `design/external-types/`.

The type itself is authored in pure TypeScript — either in the app's source, a library, or an external package. The external type definition is auto-generated from that source by the `@apexdesigner/extract-interfaces` module and regenerated on sync.

## Structure

An external type file exports a decorated class. The `@externalType()` decorator identifies the class as an external type. The import statement provides the type name and module path. The class name uses the imported symbol with an `ExternalType` suffix to avoid name collisions.

```typescript
// mat-dialog.external-type.ts

import { externalType } from "@apexdesigner/dsl";
import { MatDialog } from "@angular/material/dialog";

/** Service to open Material Design modal dialogs. */
@externalType({ injectable: true })
export class MatDialogExternalType {}
```

## Options

The `@externalType()` decorator accepts an optional options object:

| Option       | Type      | Default | Description                                                    |
| ------------ | --------- | ------- | -------------------------------------------------------------- |
| `injectable` | `boolean` | `false` | Whether the type is an injectable service that can be injected. |

## Import Statement

The import statement is the source of truth for the external type's name and module:

```typescript
import { MatDialog } from "@angular/material/dialog";
```

The validator extracts:
- `name` — the imported symbol (`MatDialog`)
- `from` — the module specifier (`@angular/material/dialog`)

## Description

Use a JSDoc comment on the class to provide a description:

```typescript
import { externalType } from "@apexdesigner/dsl";
import { HttpClient } from "@angular/common/http";

/**
 * Performs HTTP requests.
 * This service is available as an injectable class, with methods to perform HTTP requests.
 */
@externalType({ injectable: true })
export class HttpClientExternalType {}
```

## Injectable Services

Some external types are injectable Angular services. Mark these with `injectable: true`. Injectable external types can be injected as properties in [pages](pages.md#service-injection), [components](components.md#service-injection), and [services](services.md#service-injection):

```typescript
import { MatDialog } from "@services";

export class StudentPage extends Page {
  matDialog!: MatDialog;
}
```

## Built-in Angular Tokens

Angular provides several built-in injection tokens that don't use the standard `@Injectable()` decorator. These are generated as injectable external types when `@angular/core` is a dependency:

- `ElementRef`
- `ViewContainerRef`
- `TemplateRef`
- `ChangeDetectorRef`
- `Renderer2`
- `Injector`

```typescript
import { externalType } from "@apexdesigner/dsl";
import { ElementRef } from "@angular/core";

@externalType({ injectable: true })
export class ElementRefExternalType {}
```

## App Source Types

Services defined in app source files follow the same pattern with a relative import path:

```typescript
import { externalType } from "@apexdesigner/dsl";
import { AuthService } from "src/app/services/auth.service";

@externalType({ injectable: true })
export class AuthServiceExternalType {}
```

```typescript
import { externalType } from "@apexdesigner/dsl";
import { AuthGuard } from "src/app/guards/auth.guard";

@externalType({ injectable: true })
export class AuthGuardExternalType {}
```

## Examples

```typescript
import { externalType } from "@apexdesigner/dsl";
import { Router } from "@angular/router";

@externalType({ injectable: true })
export class RouterExternalType {}
```

```typescript
import { externalType } from "@apexdesigner/dsl";
import { FormBuilder } from "@angular/forms";

@externalType({ injectable: true })
export class FormBuilderExternalType {}
```

```typescript
import { externalType } from "@apexdesigner/dsl";
import { MatSnackBar } from "@angular/material/snack-bar";

/**
 * Service to dispatch Material Design snack bar messages.
 */
@externalType({ injectable: true })
export class MatSnackBarExternalType {}
```
