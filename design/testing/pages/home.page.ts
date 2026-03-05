import { Page, page, applyTemplate } from '@apexdesigner/dsl/page';

/**
 * Home
 *
 * Home page with navigation links.
 */
@page({
  path: '/home',
  isDefault: true
})
export class HomePage extends Page {}

applyTemplate(
  HomePage,
  `
  <flex-column [gap]="16">
    <h1>Home</h1>
    <a routerLink="/test-categories">Categories</a>
    <a routerLink="/test-items">Items</a>
    <a routerLink="/test-settings">Settings</a>
  </flex-column>
`
);
