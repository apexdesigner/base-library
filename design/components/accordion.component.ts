import { Component, property, method, applyTemplate, applyStyles } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray } from '@business-objects-client';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { AddFieldComponent } from '@components';
import { BusinessObjectService } from '@services';
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

  /** Business Object Service */
  businessObjectService!: BusinessObjectService;

  /** Sortable - Whether drag-and-drop reorder is enabled (auto-detected from sequence property) */
  sortable = false;

  /** Expanded Index - Track which panel is expanded to disable drag */
  expandedIndex = -1;

  /** Initialize - Auto-detect sortable from sequence property */
  @method({ callOnLoad: true })
  initialize(): void {
    const metadata = this.businessObjectService.getMetadata(this.array.entityName);
    if (metadata) {
      this.sortable = metadata.properties.some((p) => p.name === 'sequence');
      debug('sortable %o for %s', this.sortable, this.array.entityName);
    }
  }

  /** On Drop - Reorder items and update sequence values */
  async onDrop(event: CdkDragDrop<any>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;

    const items = this.items;
    const movedItem = items[event.previousIndex];
    items.splice(event.previousIndex, 1);
    items.splice(event.currentIndex, 0, movedItem);

    // Update sequence values and save
    for (let i = 0; i < items.length; i++) {
      const obj = items[i].value || items[i];
      if (obj.sequence !== i) {
        obj.sequence = i;
        if (items[i].patchValue) {
          items[i].patchValue({ sequence: i });
          items[i].markAsDirty();
        }
      }
    }

    debug('reordered %d items', items.length);
  }

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
    attributes: {
      cdkDropList: null,
      cdkDropListDisabled: '<- !sortable',
      cdkDropListDropped: '-> onDrop($event)',
    },
    contains: [
      {
        for: 'item',
        of: 'items',
        trackBy: 'item.id || $index',
        index: 'i',
        contains: [
          {
            element: 'mat-expansion-panel',
            attributes: {
              cdkDrag: null,
              cdkDragDisabled: '<- expandedIndex === i',
              opened: '-> expandedIndex = i',
              closed: '-> expandedIndex = -1',
            },
            contains: [
              {
                element: 'mat-expansion-panel-header',
                contains: [
                  {
                    if: 'sortable && expandedIndex === -1',
                    name: 'dragHandle',
                    contains: [{ 'mat-icon': 'drag_indicator', attributes: { cdkDragHandle: null, style: 'cursor: grab; margin-right: 8px; color: rgba(0,0,0,0.38)' } }],
                  },
                  { element: 'mat-panel-title', text: '{{getDisplayName(item)}}' },
                ],
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
