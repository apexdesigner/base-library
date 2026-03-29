import { Component, property, method, applyTemplate, applyStyles } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray } from '@business-objects-client';
import { AddFieldComponent } from '@components';
import { EventEmitter } from '@angular/core';
import createDebug from 'debug';

const debug = createDebug('AccordionComponent');

/**
 * Accordion
 *
 * A data-driven expansion panel list. Takes a business object array and
 * renders a mat-accordion with one mat-expansion-panel per item. Each panel
 * shows the item's display name in the header and sf-fields in the body.
 * Built-in support for adding, deleting, and navigating to an item's detail page via routerLink.
 */
export class AccordionComponent extends Component {
  /** The list of business objects to display. */
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  /** Default values when adding a new item. */
  @property({ isInput: true })
  defaults?: Record<string, any>;

  /** Hides the add field below the list. */
  @property({ isInput: true })
  hideAdd = false;

  /** Show a button to open an item's detail page. */
  @property({ isInput: true })
  includeLaunch = false;

  /** URL prefix for the launch link. */
  @property({ isInput: true })
  routePrefix?: string;

  /** Custom function returning the route for an item. */
  @property({ isInput: true })
  routeFunction?: (item: any) => string;

  /** Emitted when an item is deleted. */
  @property({ isOutput: true })
  deleted!: EventEmitter<any>;

  /** Items - Resolve the iterable list from the array */
  get items(): any[] {
    if ('controls' in this.array) {
      return (this.array as PersistedFormArray).controls;
    }
    return this.array as any[];
  }

  /** Get Display Name - Get the display value for an item */
  getDisplayName(item: any): string {
    const obj = item.value || item;
    return obj.name || obj.displayName || obj.title || obj.label || 'Item';
  }

  /** Get Route - Build the route for an item */
  getRoute(item: any): string {
    const obj = item.value || item;
    if (this.routeFunction) {
      return this.routeFunction(obj);
    }
    return (this.routePrefix || '') + '/' + obj.id;
  }

  /** Delete Item - Remove an item from the array */
  async deleteItem(item: any): Promise<void> {
    const index = Array.isArray(this.array) ? this.array.indexOf(item) : (this.array as any).controls.indexOf(item);
    await this.array.remove(index);
    this.deleted.emit(item);
  }
}

applyTemplate(AccordionComponent, [
  {
    element: 'mat-accordion',
    contains: [
      {
        for: 'item',
        of: 'items',
        trackBy: 'item.id || $index',
        contains: [
          {
            element: 'mat-expansion-panel',
            contains: [
              {
                element: 'mat-expansion-panel-header',
                contains: [{ element: 'mat-panel-title', text: '{{getDisplayName(item)}}' }]
              },
              {
                element: 'ng-template',
                attributes: { matExpansionPanelContent: null },
                contains: [
                  { element: 'sf-fields', attributes: { group: '<- item' } },
                  {
                    element: 'mat-action-row',
                    contains: [
                      {
                        if: 'includeLaunch',
                        name: 'launchSection',
                        contains: [
                          {
                            element: 'a',
                            name: 'launchButton',
                            attributes: { 'mat-icon-button': null, matTooltip: 'Open', routerLink: '<- getRoute(item)' },
                            contains: [{ 'mat-icon': 'launch' }]
                          }
                        ]
                      },
                      {
                        element: 'button',
                        name: 'deleteButton',
                        attributes: { 'mat-icon-button': null, color: 'warn', matTooltip: 'Delete', click: '-> deleteItem(item)' },
                        contains: [{ 'mat-icon': 'delete_outline' }]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    if: '!hideAdd',
    name: 'addSection',
    contains: [
      {
        element: 'add-field',
        attributes: {
          array: '<- array',
          defaults: '<- defaults',
          added: '-> array.read()',
          'style.margin-top': "<- items.length > 0 ? 'var(--accordion-add-gap)' : '0'"
        }
      }
    ]
  }
]);

applyStyles(
  AccordionComponent,
  `
  :host {
    --accordion-content-gap: 1rem;
    --accordion-add-gap: 1rem;
    --accordion-shadow-padding: 3px;
  }

  :host > mat-accordion {
    display: block;
    padding: 0 var(--accordion-shadow-padding) var(--accordion-shadow-padding);
  }

  :host > add-field {
    display: block;
  }

  sf-fields {
    margin-bottom: var(--accordion-content-gap);
  }
`
);
