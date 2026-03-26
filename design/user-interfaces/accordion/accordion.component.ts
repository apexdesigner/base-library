import { Component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray } from '@business-objects-client';
import { AddFieldComponent } from '@components';
import { EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import createDebug from 'debug';

const debug = createDebug('AccordionComponent');

/**
 * Accordion
 *
 * A data-driven expansion panel list. Takes a business object array and
 * renders a mat-accordion with one mat-expansion-panel per item. Each panel
 * shows the item's display name in the header and sf-fields in the body.
 * Built-in support for adding, deleting, and navigating to an item's detail page.
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

  /** Router */
  router!: Router;

  /** Items - Resolve the iterable list from the array */
  get items(): any[] {
    if ('controls' in this.array) {
      return (this.array as PersistedFormArray).controls;
    }
    return this.array as any[];
  }

  /** Get Display Name - Get the display value for an item */
  getDisplayName(item: any): string {
    return item.name || item.displayName || item.title || item.label || 'Item';
  }

  /** Launch - Navigate to an item's detail page */
  launch(item: any): void {
    if (this.routeFunction) {
      this.router.navigateByUrl(this.routeFunction(item));
    } else if (this.routePrefix) {
      this.router.navigateByUrl(this.routePrefix + '/' + item.id);
    }
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
                contains: [
                  { element: 'mat-panel-title', text: '{{getDisplayName(item)}}' },
                ],
              },
              { element: 'sf-fields', attributes: { group: '<- item' } },
              {
                element: 'mat-action-row',
                contains: [
                  {
                    if: 'includeLaunch',
                    name: 'launchSection',
                    contains: [
                      {
                        element: 'button',
                        name: 'launchButton',
                        attributes: { 'mat-icon-button': null, matTooltip: 'Open', click: '-> launch(item)' },
                        contains: [{ 'mat-icon': 'launch' }],
                      },
                    ],
                  },
                  {
                    element: 'button',
                    name: 'deleteButton',
                    attributes: { 'mat-icon-button': null, color: 'warn', matTooltip: 'Delete', click: '-> deleteItem(item)' },
                    contains: [{ 'mat-icon': 'delete_outline' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    if: '!hideAdd',
    name: 'addSection',
    contains: [
      {
        element: 'add-field',
        attributes: { array: '<- array', defaults: '<- defaults', added: '-> array.read()' },
      },
    ],
  },
]);
