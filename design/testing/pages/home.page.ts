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
    attributes: { gap: '<- 16' },
    contains: [
      { h1: 'Home' },
      { element: 'a', name: 'categories', text: 'Categories', attributes: { routerLink: '/test-categories' } },
      { element: 'a', name: 'items', text: 'Items', attributes: { routerLink: '/test-items' } },
      { element: 'a', name: 'settings', text: 'Settings', attributes: { routerLink: '/test-settings' } },
      { element: 'a', name: 'manageRoles', text: 'Manage Roles', attributes: { routerLink: '/manage-roles' } },
      { element: 'a', name: 'selectFields', text: 'Select Fields', attributes: { routerLink: '/test-select-fields' } },
      { element: 'a', name: 'switchUser', text: 'Switch User', attributes: { routerLink: '/switch-user' } },
      { element: 'a', name: 'appBehaviorTests', text: 'App Behavior Tests', attributes: { routerLink: '/service-test-app-behaviors' } },
      { element: 'a', name: 'openLibrary', text: 'Open Library', attributes: { routerLink: '/open-library' } }
    ]
  }
]);
