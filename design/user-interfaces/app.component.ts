import { Component, method, applyTemplate } from '@apexdesigner/dsl/component';
import { SchemaFormsService } from '@apexdesigner/schema-forms';
import { SelectUserFieldComponent } from '@components';
import { SelectRoleFieldComponent } from '@components';
import { AuthService } from '@services';

/**
 * App
 *
 * Root application component.
 */
export class AppComponent extends Component {
  /** Auth Service */
  authService!: AuthService;

  /** Schema Forms Service */
  schemaFormsService!: SchemaFormsService;

  /** Register Fields - Register custom schema form fields */
  @method({ callOnLoad: true })
  registerFields(): void {
    this.schemaFormsService.registerField('select-user', () => Promise.resolve(SelectUserFieldComponent as any));
    this.schemaFormsService.registerField('select-role', () => Promise.resolve(SelectRoleFieldComponent as any));
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
        <if condition="authService.authenticated | async">
          <avatar></avatar>
        </if>
      </flex-row>
    </mat-toolbar>
    <div grow style="padding: 0 16px">
      <router-outlet></router-outlet>
    </div>
  </flex-column>
`
);
