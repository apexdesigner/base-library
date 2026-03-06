import { Component, method, applyTemplate } from '@apexdesigner/dsl/component';
import { SchemaFormsService } from '@apexdesigner/schema-forms';

/**
 * App
 *
 * Root application component.
 */
export class AppComponent extends Component {
  /** Schema Forms Service */
  schemaFormsService!: SchemaFormsService;

  /** Register Fields - Register custom schema form fields */
  @method({ callOnLoad: true })
  registerFields(): void {
    this.schemaFormsService.registerField('select-user', () =>
      import('@components/select-user-field/select-user-field.component').then((m: any) => m.SelectUserFieldComponent)
    );
    this.schemaFormsService.registerField('select-role', () =>
      import('@components/select-role-field/select-role-field.component').then((m: any) => m.SelectRoleFieldComponent)
    );
  }
}

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
