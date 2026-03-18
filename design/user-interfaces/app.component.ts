import { Component, method, applyTemplate } from '@apexdesigner/dsl/component';
import { SchemaFormsService } from '@apexdesigner/schema-forms';
import { SelectUserFieldComponent } from '@components';
import { SelectRoleFieldComponent } from '@components';
import { SelectRoleNameFieldComponent } from '@components';
import { AuthService, PackageService } from '@services';

/**
 * App
 *
 * Root application component.
 */
export class AppComponent extends Component {
  /** Auth Service */
  authService!: AuthService;

  /** Package Service */
  packageService!: PackageService;

  /** Schema Forms Service */
  schemaFormsService!: SchemaFormsService;

  /** Register Fields - Register custom schema form fields */
  @method({ callOnLoad: true })
  registerFields(): void {
    this.schemaFormsService.registerField('select-user', () => Promise.resolve(SelectUserFieldComponent as any));
    this.schemaFormsService.registerField('select-role', () => Promise.resolve(SelectRoleFieldComponent as any));
    this.schemaFormsService.registerField('select-role-name', () => Promise.resolve(SelectRoleNameFieldComponent as any));
  }
}

applyTemplate(
  AppComponent,
  `
  <flex-column [gap]="0">
    <mat-toolbar color="primary" style="margin-bottom: 1rem">
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
    <mat-toolbar color="primary" style="font-size: 12px; min-height: 32px; height: 32px">
      Version {{packageService.version}}
    </mat-toolbar>
  </flex-column>
`
);
