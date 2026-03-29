import { Component, method, applyTemplate } from '@apexdesigner/dsl/component';
import { SchemaFormsService } from '@apexdesigner/schema-forms';
import { SelectUserFieldComponent } from '@components';
import { SelectRoleFieldComponent } from '@components';
import { SelectRoleNameFieldComponent } from '@components';
import { SfReferenceFieldComponent } from '@components';
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
    this.schemaFormsService.registerField('reference', () => Promise.resolve(SfReferenceFieldComponent as any));
  }
}

applyTemplate(AppComponent, [
  {
    element: 'flex-column',
    attributes: { gap: '<- 0' },
    contains: [
      {
        element: 'mat-toolbar',
        name: 'header',
        attributes: { color: 'primary', style: 'margin-bottom: 1rem' },
        contains: [
          {
            element: 'flex-row',
            attributes: { gap: '<- 16', alignCenter: true, grow: null },
            contains: [
              {
                element: 'a',
                text: 'PROJECT_METADATA.displayName',
                attributes: { routerLink: '/', style: 'color: inherit; text-decoration: none' }
              },
              { element: 'span', attributes: { grow: null } },
              {
                if: 'authService.authenticated | async',
                contains: [{ element: 'avatar' }]
              }
            ]
          }
        ]
      },
      {
        element: 'div',
        attributes: { grow: null, style: 'padding: 0 16px' },
        contains: [{ element: 'router-outlet' }]
      },
      {
        element: 'mat-toolbar',
        name: 'footer',
        text: 'Version {{packageService.version}}',
        attributes: { color: 'primary', style: 'font-size: 12px; min-height: 32px; height: 32px' }
      }
    ]
  }
]);
