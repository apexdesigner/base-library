import { Component, property, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray, PersistedFormGroup } from '@business-objects-client';

/**
 * Refresh Button
 *
 * An icon button that re-reads a business object array or single object.
 * Provides a one-click way to reload data using the current read configuration.
 */
export class RefreshButtonComponent extends Component {
  /** The persisted array to refresh. */
  @property({ isInput: true })
  array?: PersistedArray<any> | PersistedFormArray;

  /** The persisted form group to refresh. */
  @property({ isInput: true })
  object?: PersistedFormGroup;

  /** Refresh - Re-read the array or object */
  refresh(): void {
    if (this.array) {
      this.array.read();
    } else if (this.object) {
      this.object.read();
    }
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
