# Project

The project file defines application settings and dependencies. The project file is named `project.ts` and by default is created in `design/`.

## Class

A project file exports a class that extends `Project`.

```typescript
// project.ts

import { Project } from "@apexdesigner/dsl";

export class MyApp extends Project {}
```

The class name is the project name in PascalCase.

## Display Name

Set `displayName` for a human-readable name:

```typescript
export class MyApp extends Project {
  displayName = "My Application";
}
```

## Library

Set `isLibrary` to mark the project as a reusable library rather than an application:

```typescript
export class MyApp extends Project {
  isLibrary = true;
}
```

## Default Data Source

Set `defaultDataSource` to define the [data source](data-sources.md) used by all business objects unless [overridden](business-objects.md#data-source):

```typescript
import { Project } from "@apexdesigner/dsl";
import { Postgres } from "@data-sources";

export class MyApp extends Project {
  defaultDataSource = Postgres;
}
```

## Default Page

Set `defaultPage` to define the default page for the application:

```typescript
import { Project } from "@apexdesigner/dsl";
import { Home } from "@pages";

export class MyApp extends Project {
  defaultPage = Home;
}
```

## Parameter Values

Use `parameterValues` to define configuration parameters for a project or library. Libraries define default values that consuming projects can override or extend:

```typescript
// In a library's project.ts
import { Project } from "@apexdesigner/dsl";

export class AuthLibrary extends Project {
  isLibrary = true;
  parameterValues = {
    maxRetries: 3,
    faviconPath: "favicon.ico",
  };
}
```

```typescript
// In the consuming project's project.ts
import { Project } from "@apexdesigner/dsl";

export class MyApp extends Project {
  parameterValues = {
    authDomain: "login.example.org",
    authClientId: "dQAqoZEU9BIcUxAXnFwoBplwWJEf2Kti",
    authAudience: "https://api.example.org",
    faviconPath: "logo.png",
  };
}
```

Parameter values are merged with project values taking precedence over library values when the same key is defined. Projects can also define their own parameters independent of any library.

## Design Dependencies

Design dependencies are Apex Designer libraries that provide reusable design types. Design types are loaded from the application first, then from each dependency in the order listed:

```typescript
export class MyApp extends Project {
  designDependencies = [
    { package: "@apexdesigner/auth0-angular", versionSelector: "~19.0.0" },
    { package: "@apexdesigner/angular-material", versionSelector: "~19.0.0" },
    { package: "@apexdesigner/angular-base-library", versionSelector: "~19.0.1" },
  ];
}
```

## Client Dependencies

Client dependencies are NPM packages used in the client-side application. A string value is shorthand for the version selector:

```typescript
export class MyApp extends Project {
  clientDependencies = {
    "papaparse": "~5.4.1",
    "tinymce": "~7.3.0",
  };
}
```

Use an object value to set `developmentOnly` for dev-only packages:

```typescript
"@types/papaparse": { versionSelector: "~5.3.14", developmentOnly: true },
```

Or `isCommonJs` for CommonJS packages:

```typescript
"socketio-jwt": { versionSelector: "~4.6.2", isCommonJs: true },
```

A dependency can register package providers for dependency injection at application startup:

```typescript
"ngx-mask": {
  versionSelector: "~18.0.0",
  packageProviders: [
    { name: "provideNgxMask", provider: "provideNgxMask()" },
  ],
},
```

Use `from` when the import path differs from the package name:

```typescript
{ name: "provideNgxMask", from: "ngx-mask/lib", provider: "provideNgxMask()" },
```

## Server Dependencies

Server dependencies are NPM packages used in the server-side application. They follow the same format as client dependencies:

```typescript
export class MyApp extends Project {
  serverDependencies = {
    "loopback-connector-postgresql": "~8.0.0",
    "dayjs": "~1.11.13",
  };
}
```

## Client Dependency Overrides

Use `clientDependencyOverrides` to override transitive dependency versions on the client side. The format matches NPM's `overrides` in `package.json`:

```typescript
export class MyApp extends Project {
  clientDependencyOverrides = {
    "some-package": "^2.0.0",
  };
}
```

## Server Dependency Overrides

Use `serverDependencyOverrides` to override transitive dependency versions on the server side:

```typescript
export class MyApp extends Project {
  serverDependencyOverrides = {
    uuid: "^8.3.2",
    "loopback-connector-postgresql": {
      chalk: "^4.1.2",
    },
  };
}
```

## Scripts

Define NPM scripts for client and/or server package.json files using `clientScripts` and `serverScripts` properties:

```typescript
import { Project } from "@apexdesigner/dsl";

export class MyApp extends Project {
  clientScripts = {
    dev: "vite dev",
    build: "vite build",
    test: "vitest",
    lint: "eslint src"
  };

  serverScripts = {
    dev: "tsx watch src/index.ts",
    build: "tsc",
    start: "node dist/index.js",
    test: "vitest"
  };
}
```

### Script Inheritance

Libraries can define scripts that consuming projects inherit:

```typescript
// In a Loopback library's project.ts
import { Project } from "@apexdesigner/dsl";

export class LoopbackLibrary extends Project {
  isLibrary = true;

  serverScripts = {
    dev: "nodemon src/index.ts",
    build: "tsc",
    start: "node dist/index.js",
    migrate: "lb4 migrate"
  };
}
```

Projects extending the library inherit all scripts and can override individual scripts by key:

```typescript
import { LoopbackLibrary } from "@loopback/library";

export class MyApp extends LoopbackLibrary {
  // Override just "dev", inherit build, start, migrate
  serverScripts = {
    dev: "tsx watch src/index.ts"  // Overrides library's dev script
  };

  clientScripts = {
    dev: "vite dev",
    build: "vite build"
  };
}
```

Scripts are merged with project scripts taking precedence over library scripts when the same key is defined.

## Styles

Use `applyStyles()` to contribute CSS to the application-level `styles.scss`. Libraries and projects can each contribute styles, which the generators merge together:

```typescript
import { Project, applyStyles } from "@apexdesigner/dsl";

export class MyApp extends Project {}

applyStyles(MyApp, `
  body {
    font-family: Roboto, sans-serif;
    margin: 0;
  }

  .app-container {
    max-width: 1200px;
    margin: 0 auto;
  }
`);
```

### Style Inheritance

Libraries can provide base styles that consuming projects build upon:

```typescript
// In a library's project.ts
import { Project, applyStyles } from "@apexdesigner/dsl";

export class MaterialLibrary extends Project {
  isLibrary = true;
}

applyStyles(MaterialLibrary, `
  @import '@angular/material/prebuilt-themes/indigo-pink.css';

  .mat-toolbar {
    position: sticky;
    top: 0;
  }
`);
```

The consuming project's styles are layered on top of library styles:

```typescript
import { MaterialLibrary } from "@material/library";
import { applyStyles } from "@apexdesigner/dsl";

export class MyApp extends MaterialLibrary {}

applyStyles(MyApp, `
  .mat-toolbar {
    background-color: #1a237e;
  }
`);
```

Library styles are included first, followed by project styles, allowing projects to override library defaults.
