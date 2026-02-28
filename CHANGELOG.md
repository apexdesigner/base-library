# Changelog

## [1.0.86] - 2026-02-28

- 76d2650 feat: add optional queryParams input to breadcrumb level


## [1.0.85] - 2026-02-28

- 3a85c16 chore: apply automated fixes
- f0371bb chore: remove stale local doc-generators dev dependency


## [1.0.84] - 2026-02-28

- 0da554c chore: apply automated fixes
- ae0490b chore: update doc-generators to 0.0.8
- cb3a08e feat: add breadcrumb components and doc-generators design dependency
- 4e597f2 fix: prevent duplicate ActivatedRoute import when design file already imports from @angular/router
- ab87117 fix: recursively create lazy controls in nested PersistedFormGroup


## [1.0.83] - 2026-02-28

- 3bd39e1 docs: add parent scope section and boundary diagram to component docs
- 77c7b3c feat: generate BO After Start lifecycle behaviors as standalone files
- 3d0d427 feat: inject external types marked injectable in page, component, and service generators


## [1.0.82] - 2026-02-27

- d96bdba fix: resolve base type properties to native zod types in schema generator


## [1.0.81] - 2026-02-27

- f5bd4f2 feat: remove isLibrary filters so generators include library items


## [1.0.80] - 2026-02-27

- 3fb928d fix: restore BO check in Behavior trigger conditions


## [1.0.79] - 2026-02-27

- 312c60a fix: remove isLibrary conditions from type generators


## [1.0.78] - 2026-02-27

- 611ef60 feat: generate App.dataSources as plural map and add Uuid base type
- ad75923 chore: bump schema-persistence and generator to latest
- 9f168bd docs: add design doc for add-button dialog component
- 3497972 chore: update @apexdesigner package version selectors to latest


## [1.0.77] - 2026-02-26

- 3ac2776 chore: apply automated fixes
- 9184730 feat: add service generators and page service injection
- b350c56 feat: validate rootDir is required for File data sources


## [1.0.76] - 2026-02-26

- fb4b727 fix: resolve base types to native types in client generators


## [1.0.75] - 2026-02-26

- 319ff2b fix: app generator uses unified data source import


## [1.0.74] - 2026-02-26

- 66f194a feat: cross-data-source relationship pages and test improvements
- a836101 feat: federated data source generator and file persistence support


## [1.0.73] - 2026-02-26

- f201608 chore: apply automated fixes from dependency updates
- d17d51f feat: lazy relationship control initialization and client behavior fixes


## [1.0.72] - 2026-02-25

- 5d53f33 fix: update dialog input test to match getter/setter backing field
- 1a7df75 chore: apply automated fixes from dependency updates
- 2bf5602 fix: skip mixin behaviors in BO generator triggers and fix type errors
- 2657c27 docs: add client-side and server-side debug pattern docs
- a90cf59 feat: add isDialog component generation, ViewChild support, and input getter/setter forwarding


## [1.0.71] - 2026-02-25

- dcda63e feat: delegate instance behavior methods on FormGroup classes


## [1.0.70] - 2026-02-25

- 87b4ffb fix: chain .view() before .as() in generated schema for view-backed BOs


## [1.0.69] - 2026-02-25

- 5dfe66f feat: support view-backed business objects via setView()


## [1.0.68] - 2026-02-25

- 7869787 fix: use lazy getter for App.businessObjects to avoid circular import TDZ


## [1.0.67] - 2026-02-25

- 2b83128 fix: generate skip test file for BOs/behaviors without addTest() calls


## [1.0.66] - 2026-02-25

- 224a645 fix: return empty Map instead of undefined when test generators have no output


## [1.0.65] - 2026-02-25

- 46b2502 fix: return undefined instead of empty string when no tests exist


## [1.0.64] - 2026-02-25

- 896e82d fix: use App.dataSources for afterEach truncateAll in app test generator


## [1.0.63] - 2026-02-25

- 67a18ec chore: apply automated fixes
- e79d7e4 feat: replace setTestData/createTestData with test fixture support


## [1.0.62] - 2026-02-25

- c5bdfc2 feat: add test generators, App dataSources/businessObjects, convert static generators to files


## [1.0.61] - 2026-02-25

- 6444f10 fix: include static dataSource property in generated BO type declarations


## [1.0.60] - 2026-02-25

- 3659a95 feat: add lifecycle app behavior generator


## [1.0.59] - 2026-02-25

- 458c82f Fix route generator type errors for string ids and no-param behaviors


## [1.0.58] - 2026-02-24

- f427faf Fix generate using behavior metadata instead of parent BO metadata


## [1.0.57] - 2026-02-24

- 8ecd9c9 Fix behavior trigger outputs resolving to wrong file paths


## [1.0.56] - 2026-02-24

- 541c030 Replace app-behavior generator with App class generator


## [1.0.55] - 2026-02-24

- f682107 Add behavior import scanning to business-object generator


## [1.0.54] - 2026-02-24

- b212ab5 fix: resolve base type ids to primitive types in all generators


## [1.0.53] - 2026-02-24

- 6567281 fix: generate z.uuid() for base type id and FK fields


## [1.0.52] - 2026-02-24

- 05f8790 feat: generate z.enum() for base types with applyValidValues


## [1.0.51] - 2026-02-24

- 5873385 fix: inject scoped debug into generated behavior methods


## [1.0.50] - 2026-02-24

- 7479795 chore: apply automated fixes
- b8ac8ea feat: apply base type column defaults to generated schemas


## [1.0.49] - 2026-02-24

- 5bcbc1a Add .nullable() to optional schema fields so null can clear values


## [1.0.48] - 2026-02-24

- 168cc6d chore: apply automated fixes
- 42bd4dd Fix schema generator not emitting .optional() for optional foreign keys


## [1.0.47] - 2026-02-24

- 763e789 chore: apply automated fixes
- 8c04aac Move description to root package.json; update base-types.md
- 61b2c58 Fix description to use single string literal so getStringPropertyValue reads it correctly
- cee032c Expand project description for better Claude context
- 2156ecf Remove includeInSkills from project.ts; include docs/ in published package
- 741ad0e Restructure docs: split patterns into individual files, update root README
- 0e0b788 Split form-group type generator into separate files; fix PersistedArray typecheck
- 1594c11 Fix afterReadCall not being called for PersistedArray/FormArray properties
- cf7cc71 Add shared property-processing utility and fix BO import handling


## [1.0.46] - 2026-02-23

- 9f6e4d9 Update @apexdesigner deps to latest; fix shared.test.ts imports


## [1.0.45] - 2026-02-23

- 9cac351 Fix page generator missing callAfterLoad -> ngAfterViewInit lifecycle hook


## [1.0.44] - 2026-02-23

- efb36f5 Add callOnLoad/callOnUnload lifecycle hooks for component and page generators
- 78f6e69 Fix app-type generator output path from index.d.ts to app.d.ts


## [1.0.43] - 2026-02-23

- 1bb75bf Refactor shared template utilities to use @apexdesigner/generator package
- 08cbfe3 Add Behavior trigger to all generators that consume behaviors
- a88693f Fix app-type generator output path to app/index.d.ts for correct @project resolution


## [1.0.42] - 2026-02-22

- 045b4f8 Add app-type generator for design/@types/app.d.ts and install @types/debug


## [1.0.41] - 2026-02-22

- 4a89b2f Fix persisted-form-group outputs path to match generate function


## [1.0.40] - 2026-02-22

- b4d6830 chore: apply automated fixes
- 8e0245f Fix minimum version selectors for @apexdesigner/generator and @apexdesigner/utilities


## [1.0.39] - 2026-02-22

- ef11ed9 Move form group types to business-objects-client and fix id type resolution
- 12f663a Fix id type resolution across all generators using resolveIdType


## [1.0.38] - 2026-02-22

- 95a3829 chore: apply automated fixes
- 7bf7cc7 Fix id and FK type resolution in @types generator for type aliases like Uuid


## [1.0.37] - 2026-02-21

- 585f6be chore: update package-lock.json
- 25b814b Throw error for unsupported AppBehavior lifecycleStage


## [1.0.36] - 2026-02-20

- 597f02b Fix foreign key type mismatch for Postgres integer ids


## [1.0.35] - 2026-02-20

- f6f9c29 Add debug logging to route and business object generators


## [1.0.34] - 2026-02-20

- adeaa7d Fix debug namespace to use main project name instead of library name


## [1.0.33] - 2026-02-20

- bc71dbf Fix routes/index.ts to always export a default router


## [1.0.32] - 2026-02-20

- b1aeadf Fix case-insensitive Postgres persistenceType check for autoIncrement inference


## [1.0.31] - 2026-02-20

- 8a3787e Fix routes-index to use plural names matching route file output


## [1.0.30] - 2026-02-20

- 833de4d chore: apply automated fixes
- 99e9cd7 Always generate routes/index.ts, with comment when no business objects
- eb7a4d6 Infer autoIncrement for Postgres numeric ids without requiring decorator


## [1.0.29] - 2026-02-20

- fb09feb Pass column decorator config through to schema for all property types


## [1.0.28] - 2026-02-20

- 4cdd47b Throw error instead of returning empty string when DataSource missing persistenceType


## [1.0.27] - 2026-02-20

- a3d7ba9 Error on DataSource missing persistenceType instead of silently generating empty file


## [1.0.26] - 2026-02-20

- 3bf5f67 chore: apply automated fixes
- 0677c88 Remove packageName, repository, and version from project.ts design


## [1.0.25] - 2026-02-20

- aaba355 Skip server BO generation when no data source; add data source close on shutdown; bump schema-persistence to 0.1.74
- 628fc9a Restore proper graceful shutdown with closeAllConnections


## [1.0.24] - 2026-02-20

- 3c301f3 Add SIGINT/SIGTERM handlers for clean shutdown


## [1.0.23] - 2026-02-20

- 4400654 Add dev script and tsx devDependency to server


## [1.0.22] - 2026-02-20

- ede3f0c chore: apply automated fixes
- 0082c42 Fix server startup: inline dotenv loader, correct start script


## [1.0.21] - 2026-02-20

- 847652e Fix server startup: use listening event and surface errors


## [1.0.20] - 2026-02-20

- 834847d chore: apply automated fixes
- 9b27b4b Remove peerDependencies


## [1.0.19] - 2026-02-20

- 6493d38 chore: apply automated fixes
- 7a5f8c3 Add peerDependencies for generator runtime packages


## [1.0.18] - 2026-02-20

- bd76c8c Include generators directory in published npm package


## [1.0.17] - 2026-02-20

- c24ef92 chore: apply automated fixes
- d979d1b Use PROJECT_METADATA.displayName in app component toolbar
- 78ad648 Remove add-issue-to-project workflow
- ccc43c7 Remove non-canonical GitHub Actions workflows
- 81e5850 Gitignore generated client, server, and design/@types directories
- f9f5f5a chore: bump version to 1.0.16
- 0d07e4d chore: apply automated fixes
- 9f3576f Update project metadata: description, displayName, license, repository
- 0aee549 Add GitHub Actions workflows for CI/CD and issue automation
- 39943b0 Migrate to TypeScript-based design with generators, client, and server
- 98e8db4 Update @apexdesigner deps and fix design tsconfig path resolution


## [1.0.16] - 2026-02-20

- 0d07e4d chore: apply automated fixes
- 9f3576f Update project metadata: description, displayName, license, repository
- 0aee549 Add GitHub Actions workflows for CI/CD and issue automation
- 39943b0 Migrate to TypeScript-based design with generators, client, and server
- 98e8db4 Update @apexdesigner deps and fix design tsconfig path resolution


