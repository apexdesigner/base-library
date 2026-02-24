# Pipe Interfaces

A pipe interface describes a template pipe available for use in [templates](templates.md) with the `|` syntax. Pipe interface files are named `<name>.pipe-interface.ts` and by default are created in `design/template-interfaces/`.

The pipe itself is authored in pure TypeScript — either in the app's source, a library, or an external package. The pipe interface is auto-generated from that source by the `@apexdesigner/extract-interfaces` module and regenerated on sync.

## Structure

A pipe interface file exports a class with a `@pipeInterface()` decorator. The class name uses the imported symbol with a `PipeInterface` suffix to avoid name collisions.

```typescript
// date-pipe.pipe-interface.ts

import { pipeInterface } from "@apexdesigner/dsl/pipe-interface";
import { DatePipe } from "@angular/common";

@pipeInterface({ selector: "date" })
export class DatePipePipeInterface {}
```

## Decorator

The `@pipeInterface()` decorator provides the pipe name used in templates.

```typescript
@pipeInterface({ selector: "date" })
```

- `selector` — the pipe name used in template expressions (e.g., `{{ value | date }}`)

## Import Statement

The non-framework import statement tells the code generator what to import in the Angular application:

```typescript
import { DatePipe } from "@angular/common";
```

## Description

Use a JSDoc comment on the class to provide a description:

```typescript
/**
 * Formats a date value according to locale rules.
 */
@pipeInterface({ selector: "date" })
export class DatePipePipeInterface {}
```

## App Source Pipes

Pipes defined in app source files follow the same pattern with a relative import path:

```typescript
import { pipeInterface } from "@apexdesigner/dsl/pipe-interface";
import { SafeUrlPipe } from "src/app/pipes/safe-url.pipe";

@pipeInterface({ selector: "safe" })
export class SafeUrlPipePipeInterface {}
```

## Examples

```typescript
import { pipeInterface } from "@apexdesigner/dsl/pipe-interface";
import { AsyncPipe } from "@angular/common";

/**
 * Unwraps a value from an asynchronous primitive.
 */
@pipeInterface({ selector: "async" })
export class AsyncPipePipeInterface {}
```

```typescript
import { pipeInterface } from "@apexdesigner/dsl/pipe-interface";
import { CurrencyPipe } from "@angular/common";

@pipeInterface({ selector: "currency" })
export class CurrencyPipePipeInterface {}
```

```typescript
import { pipeInterface } from "@apexdesigner/dsl/pipe-interface";
import { KeyValuePipe } from "@angular/common";

@pipeInterface({ selector: "keyvalue" })
export class KeyValuePipePipeInterface {}
```
