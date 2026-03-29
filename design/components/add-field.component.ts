import { Component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray } from '@business-objects-client';
import { BusinessObjectService } from '@services';
import { EventEmitter } from '@angular/core';
import * as changeCase from 'change-case';
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

  /** Has Sequence */
  hasSequence = false;

  /** Auto Format - Case format for the first property */
  autoFormat?: string;

  /** Initialize - Derive label and first property from metadata */
  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    const metadata = this.businessObjectService.getMetadata(this.array.entityName);
    if (metadata) {
      if (!this.label) {
        this.defaultLabel = 'Add ' + metadata.indefiniteArticle + ' ' + metadata.displayName + '...';
      }
      const firstProp = metadata.properties.find(p => p.name !== 'id');
      if (firstProp) {
        this.firstPropertyName = firstProp.name;
      }
      this.hasSequence = metadata.properties.some(p => p.name === 'sequence');
    }

    // Detect auto-format from the schema form control metadata
    const formGroup = await this.businessObjectService.loadFormGroup(this.array.entityName);
    const control = formGroup.controls?.[this.firstPropertyName] as any;
    if (control?.metadata?.format) {
      this.autoFormat = control.metadata.format;
    }

    debug('label %s, firstProperty %s, hasSequence %o, autoFormat %s', this.label || this.defaultLabel, this.firstPropertyName, this.hasSequence, this.autoFormat);
  }

  /** Add - Create a new item with the input value */
  async add(): Promise<void> {
    const value = this.inputValue.trim();
    if (!value) return;

    const formatted = this.autoFormat && (changeCase as any)[this.autoFormat] ? (changeCase as any)[this.autoFormat](value) : value;
    const data: Record<string, any> = { ...this.defaults, [this.firstPropertyName]: formatted };
    if (this.hasSequence && data.sequence === undefined) {
      data.sequence = this.array.length || 0;
    }
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
