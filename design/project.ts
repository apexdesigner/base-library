import { Project, applyStyles } from '@apexdesigner/dsl';

/**
 * Base Library
 *
 * Shared component and infrastructure library for Apex Designer applications.
 */
export class BaseLibrary extends Project {
  displayName = 'Base Library';

  isLibrary = true;

  designDependencies = [{ package: '@apexdesigner/doc-generators', versionSelector: '^0.1.2' }];

  parameterValues = {
    formFieldAppearance: 'outline',
    formFieldSubscriptSizing: 'dynamic',
    formFieldFloatLabel: 'always',
    favicon: 'favicon.ico'
  };

  clientDependencies = {
    '@angular/animations': '~19.2.0',
    '@angular/common': '~19.2.0',
    '@angular/compiler': '~19.2.0',
    '@angular/core': '~19.2.0',
    '@angular/forms': '~19.2.0',
    '@angular/platform-browser': '~19.2.0',
    '@angular/platform-browser-dynamic': '~19.2.0',
    '@angular/cdk': '~19.2.0',
    '@angular/material': '~19.2.0',
    '@angular/router': '~19.2.0',
    '@apexdesigner/declarative-tables': '^0.1.10',
    '@apexdesigner/schema-forms': '^0.1.65',
    '@monaco-editor/loader': '^1.7.0',
    debug: { versionSelector: '^4.4.3', isCommonJs: true },
    indefinite: { versionSelector: '^2.4.6', isCommonJs: true },
    pluralize: { versionSelector: '^8.0.0', isCommonJs: true },
    'change-case': '^5.4.4',
    luxon: '^3.0.0',
    '@types/luxon': { versionSelector: '^3.0.0', developmentOnly: true },
    '@apexdesigner/flex-layout': '^0.1.20',
    'angular-auth-oidc-client': '^19.0.0',
    rxjs: '~7.8.1',
    tslib: '~2.8.0',
    zod: '^4.1.13',
    '@apexdesigner/schema-tools': '^0.1.76',
    'zone.js': '~0.15.0',
    '@angular/cli': { versionSelector: '~19.2.0', developmentOnly: true },
    '@angular/compiler-cli': { versionSelector: '~19.2.0', developmentOnly: true },
    '@angular-devkit/build-angular': { versionSelector: '~19.2.0', developmentOnly: true },
    typescript: { versionSelector: '~5.7.0', developmentOnly: true }
  };

  clientScripts = {
    ng: 'ng',
    start: 'ng serve',
    build: 'ng build',
    test: 'ng test'
  };

  serverDependencies = {
    '@apexdesigner/schema-persistence': '^0.1.88',
    '@apexdesigner/schema-tools': '^0.1.76',
    debug: '^4.4.3',
    express: '^5.1.0',
    zod: '^4.1.13',
    jsonwebtoken: '^9.0.0',
    'jwks-rsa': '^3.0.0',
    pg: '^8.16.0',
    '@apexdesigner/slack-alerts': '^0.1.7',
    'path-to-regexp': '^8.0.0',
    '@types/debug': { versionSelector: '^4.1.12', developmentOnly: true },
    '@types/express': { versionSelector: '^5.0.3', developmentOnly: true },
    '@types/jsonwebtoken': { versionSelector: '^9.0.0', developmentOnly: true },
    tsx: { versionSelector: '^4.0.0', developmentOnly: true },
    '@electric-sql/pglite': { versionSelector: '^0.3.14', developmentOnly: true }
  };

  serverScripts = {
    build: 'tsc',
    start: 'node dist/index.js',
    dev: 'tsx watch src/index.ts'
  };
}

applyStyles(
  BaseLibrary,
  `
@use '@angular/material' as mat;
@import url('https://fonts.googleapis.com/icon?family=Material+Icons');

html, body {
  height: 100%;
}

body {
  margin: 0;
  font-family: Roboto, "Helvetica Neue", sans-serif;
}

h1, h2, h3, h4, h5, h6, p {
  margin: 0;
}

mat-form-field {
  padding-top: 4px;
  width: 100%;
}

// Make disabled form field text more readable
.mat-mdc-form-field input[disabled],
.mat-mdc-form-field textarea[disabled],
.mat-mdc-form-field .mat-mdc-select-disabled .mat-mdc-select-value {
  color: rgba(0, 0, 0, 0.87);
  -webkit-text-fill-color: rgba(0, 0, 0, 0.87);
}
`
);
