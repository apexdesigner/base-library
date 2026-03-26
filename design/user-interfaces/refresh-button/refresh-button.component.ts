import { Component, property, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray } from '@business-objects-client';

/**
 * Refresh Button
 *
 * An icon button that re-reads a business object array. Provides a
 * one-click way to reload data using the array's current read configuration.
 */
export class RefreshButtonComponent extends Component {
  /** The persisted array to refresh. */
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  /** Refresh - Re-read the array */
  refresh(): void {
    this.array.read();
  }
}

applyTemplate(RefreshButtonComponent, [
  {
    element: 'button',
    name: 'refreshButton',
    attributes: {
      'mat-icon-button': null,
      matTooltip: 'Refresh',
      click: '-> refresh()'
    },
    contains: [{ 'mat-icon': 'autorenew' }]
  }
]);
