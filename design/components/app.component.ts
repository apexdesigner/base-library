import { Component, applyTemplate } from "@apexdesigner/dsl/component";

/**
 * App
 *
 * Root application component.
 */
export class AppComponent extends Component {}

applyTemplate(AppComponent, `
  <flex-column>
    <mat-toolbar color="primary">
      <span>Base Library</span>
    </mat-toolbar>
    <div grow style="padding: 0 16px">
      <router-outlet></router-outlet>
    </div>
  </flex-column>
`);
