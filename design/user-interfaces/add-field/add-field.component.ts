import { Component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray } from '@business-objects-client';
import { BusinessObjectService } from '@services';
import { EventEmitter } from '@angular/core';
import createDebug from 'debug';

const debug = createDebug('AddFieldComponent');

/**
 * Add Field
 *
 * An inline text input for adding a new item to a business object array.
 * Types a name, presses Enter, and the item is created with that name as
 * its first visible property.
 */
export class AddFieldComponent extends Component {
  /** The persisted array to add items to. */
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  /** Placeholder/label for the input field. */
  @property({ isInput: true })
  label?: string;

  /** Default property values for new items. */
  @property({ isInput: true })
  defaults?: Record<string, any>;

  /** Case transformation before saving (e.g., 'capitalCase'). */
  @property({ isInput: true })
  nameCase?: string;

  /** Emitted with the newly created item. */
  @property({ isOutput: true })
  added!: EventEmitter<any>;

  /** Business Object Service */
  businessObjectService!: BusinessObjectService;

  /** Input Value */
  inputValue = '';

  /** Default Label */
  defaultLabel = 'Add';

  /** First Property Name */
  firstPropertyName = 'name';

  /** Initialize - Derive label and first property from metadata */
  @method({ callOnLoad: true })
  initialize(): void {
    const metadata = this.businessObjectService.getMetadata(this.array.entityName);
    if (metadata) {
      if (!this.label) {
        this.defaultLabel = 'Add ' + metadata.indefiniteArticle + ' ' + metadata.displayName + '...';
      }
      const firstProp = metadata.properties.find(p => p.name !== 'id');
      if (firstProp) {
        this.firstPropertyName = firstProp.name;
      }
    }
    debug('label %s, firstProperty %s', this.label || this.defaultLabel, this.firstPropertyName);
  }

  /** Add - Create a new item with the input value */
  async add(): Promise<void> {
    const value = this.inputValue.trim();
    if (!value) return;

    const data: Record<string, any> = { ...this.defaults, [this.firstPropertyName]: value };
    const item = await this.array.add(data);
    this.inputValue = '';
    this.added.emit(item);
  }
}

applyTemplate(AddFieldComponent, [
  {
    element: 'mat-form-field',
    attributes: { style: 'width: 100%' },
    contains: [
      {
        element: 'input',
        name: 'addInput',
        attributes: {
          matInput: null,
          placeholder: '<- label || defaultLabel',
          ngModel: '<-> inputValue',
          'keyup.enter': '-> add()'
        }
      }
    ]
  }
]);
