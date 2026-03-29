import { Component, component, applyTemplate, applyStyles } from '@apexdesigner/dsl/component';
import { BreadcrumbLevelComponent } from '@components';

/**
 * Breadcrumb
 *
 * Navigation breadcrumb container that displays child breadcrumb levels separated by delimiters.
 */
@component({ allowChildren: true })
export class BreadcrumbComponent extends Component {
  /** Levels - Array of breadcrumb navigation levels */
  levels!: BreadcrumbLevelComponent[];
}

applyTemplate(BreadcrumbComponent, [{ element: 'ng-content' }]);

applyStyles(
  BreadcrumbComponent,
  `
  :host {
    display: flex;
    align-items: center;
    font-size: 14px;
  }
`
);
