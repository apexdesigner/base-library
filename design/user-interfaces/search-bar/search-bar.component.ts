import { Component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray } from '@business-objects-client';
import { BusinessObjectService } from '@services';
import createDebug from 'debug';

const debug = createDebug('SearchBarComponent');

/**
 * Search Bar
 *
 * A text input that filters a business object array by searching across all
 * string properties. Applies a debounced server-side ilike filter.
 */
export class SearchBarComponent extends Component {
  /** The persisted array to filter. */
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  /** Business Object Service */
  businessObjectService!: BusinessObjectService;

  /** Search Text */
  searchText = '';

  /** Debounce Timer */
  private searchTimer: any;

  /** Search - Apply filter and re-read the array */
  search(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applySearch(), 250);
  }

  /** Apply Search - Execute the filtered read */
  async applySearch(): Promise<void> {
    const text = this.searchText.trim();
    if (!text) {
      this.array.readFilter = {};
      await this.array.read();
      return;
    }

    const metadata = this.businessObjectService.getMetadata(this.array.entityName);
    if (!metadata) {
      debug('no metadata for %s', this.array.entityName);
      return;
    }

    const stringProps = metadata.properties.filter((p) => p.type === 'string' || p.type === 'text');
    const conditions = stringProps.map((p) => ({ [p.name]: { ilike: '%' + text + '%' } }));

    if (conditions.length > 0) {
      this.array.readFilter = { or: conditions };
    }

    await this.array.read();
  }
}

applyTemplate(SearchBarComponent, [
  {
    element: 'mat-form-field',
    attributes: { style: 'width: 100%' },
    contains: [
      { 'mat-icon': 'search', attributes: { matPrefix: null } },
      {
        element: 'input',
        name: 'searchInput',
        attributes: {
          matInput: null,
          placeholder: 'Search',
          ngModel: '<-> searchText',
          ngModelChange: '-> search()',
        },
      },
    ],
  },
]);
