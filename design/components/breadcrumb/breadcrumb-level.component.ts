import { Component, property, applyTemplate, applyStyles } from '@apexdesigner/dsl/component';
import { component } from '@apexdesigner/dsl/dist/component';
import { BreadcrumbComponent } from '@components';

/**
 * Breadcrumb Level
 *
 * A single level inside a Breadcrumb. Renders as a link when path is set, plain text otherwise.
 */
@component({ parentComponent: BreadcrumbComponent })
export class BreadcrumbLevelComponent extends Component {
  /** Text displayed for this breadcrumb level. */
  @property({ isInput: true })
  label!: string;

  /** Router path to navigate to when clicked. When not set, the level renders as plain text. */
  @property({ isInput: true })
  path?: string;

  /** Optional query parameters to include in the navigation link. */
  @property({ isInput: true })
  queryParams?: any;
}

applyTemplate(BreadcrumbLevelComponent, [
  {
    if: 'path',
    name: 'hasPath',
    contains: [
      {
        element: 'a',
        text: '{{label}}',
        attributes: { routerLink: '<- path', queryParams: '<- queryParams' }
      }
    ]
  },
  {
    if: '!path',
    name: 'noPath',
    contains: [{ element: 'span', text: '{{label}}', attributes: { class: 'current' } }]
  }
]);

applyStyles(
  BreadcrumbLevelComponent,
  `
  :host {
    display: flex;
    align-items: center;
  }
  :host:not(:first-child)::before {
    content: '›';
    margin: 0 8px;
    color: rgba(0, 0, 0, 0.54);
  }
  a {
    color: var(--apex-primary, #1976d2);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  .current {
    color: rgba(0, 0, 0, 0.54);
  }
`
);
