import { Page, page, method, applyTemplate } from '@apexdesigner/dsl/page';
import { BusinessObjectService } from '@services';
import { AppService } from '@services';
import { SchemaFormsService } from '@apexdesigner/schema-forms';
import { SchemaFormsTypescriptService } from '@apexdesigner/schema-forms';
import createDebug from 'debug';

const debug = createDebug('HomePage');

/**
 * Home
 *
 * Home page with navigation links.
 */
@page({
  path: '/home',
  isDefault: true
})
export class HomePage extends Page {
  /** Business Object Service */
  businessObjectService!: BusinessObjectService;
  /** App Service */
  appService!: AppService;
  /** Schema Forms Service */
  schemaFormsService!: SchemaFormsService;
  /** Schema Forms Typescript Service */
  schemaFormsTypescriptService!: SchemaFormsTypescriptService;

  /** Log Services */
  @method({ callOnLoad: true })
  async logServices(): Promise<void> {
    debug('businessObjectService.metadata %o', this.businessObjectService.metadata);
    debug('appService.behaviors %o', this.appService.behaviors);
    debug('schemaFormsService %o', this.schemaFormsService);
    debug('schemaFormsTypescriptService %o', this.schemaFormsTypescriptService);
  }
}

applyTemplate(HomePage, [
  {
    element: 'flex-column',
    gap: '= 16',
    contains: [
      { h1: 'Home' },
      { element: 'a', text: 'Categories', routerLink: '/test-categories' },
      { element: 'a', text: 'Items', routerLink: '/test-items' },
      { element: 'a', text: 'Settings', routerLink: '/test-settings' },
      { element: 'a', text: 'Manage Roles', routerLink: '/manage-roles' },
      { element: 'a', text: 'Select Fields', routerLink: '/test-select-fields' },
      { element: 'a', text: 'Switch User', routerLink: '/switch-user' },
      { element: 'a', text: 'App Behavior Tests', routerLink: '/service-test-app-behaviors' },
    ],
  },
]);
