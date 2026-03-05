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
      <flex-row [gap]="16" grow>
        <span>PROJECT_METADATA.displayName</span>
        <a routerLink="/test-categories">Categories</a>
        <a routerLink="/test-items">Items</a>
        <a routerLink="/test-settings">Settings</a>
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
