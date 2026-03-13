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

applyTemplate(
  HomePage,
  `
  <flex-column [gap]="16">
    <h1>Home</h1>
    <a routerLink="/test-categories">Categories</a>
    <a routerLink="/test-items">Items</a>
    <a routerLink="/test-settings">Settings</a>
    <a routerLink="/manage-roles">Manage Roles</a>
    <a routerLink="/test-select-fields">Select Fields</a>
    <a routerLink="/switch-user">Switch User</a>
  </flex-column>
`
);
