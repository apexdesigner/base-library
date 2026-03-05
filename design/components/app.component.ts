import { Component, applyTemplate } from '@apexdesigner/dsl/component';

/**
 * App
 *
 * Root application component.
 */
export class AppComponent extends Component {}

applyTemplate(
  AppComponent,
  `
  <flex-column>
    <mat-toolbar color="primary">
      <flex-row [gap]="16" [alignCenter]="true" grow>
        <a routerLink="/" style="color: inherit; text-decoration: none">PROJECT_METADATA.displayName</a>
        <span grow></span>
        <avatar></avatar>
      </flex-row>
    </mat-toolbar>
    <div grow style="padding: 0 16px">
      <router-outlet></router-outlet>
    </div>
  </flex-column>
`
);
