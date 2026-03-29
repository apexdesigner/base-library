import { Component, component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { SchemaFormControl } from '@apexdesigner/schema-forms';
import { FormControl } from '@angular/forms';
import { BusinessObjectService } from '@services';
import { getRelationshipMetadata } from '@apexdesigner/schema-tools';
import { capitalCase } from 'change-case';
import createDebug from 'debug';

const debug = createDebug('SfReferenceFieldComponent');

/**
 * Sf Reference Field
 *
 * A schema form field component for reference foreign key properties.
 * Displays a mat-autocomplete that searches the referenced entity by
 * its display property and stores the selected record's id.
 */
@component({ fieldFormat: 'reference' })
export class SfReferenceFieldComponent extends Component {
  /** Control */
  @property({ isInput: true })
  control!: SchemaFormControl;

  /** Label - Label passed from sf-field, overrides derived label */
  @property({ isInput: true })
  label?: string;

  /** Placeholder */
  @property({ isInput: true })
  placeholder?: string;

  /** Hide Help Text */
  @property({ isInput: true })
  hideHelpText?: boolean;

  /** Business Object Service */
  businessObjectService!: BusinessObjectService;

  /** Target Entity Name */
  targetEntity = '';

  /** Display Property */
  displayProp = 'name';

  /** Options */
  options: any[] = [];

  /** Autocomplete Reference */
  auto: any;

  /** Input Control - Drives the text input and error state */
  inputControl = new FormControl<string>('');

  /** Entity Class */
  entityClass: any;

  /** No Matches */
  noMatches = false;

  /** Initialize - Discover the referenced entity and set initial display value */
  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    const parent = (this.control as any).parent;
    if (!parent?.schema?.shape) return;

    const fkName = (this.control as any).propertyName;
    debug('fkName %s, control.displayName %s, control.label %s', fkName, (this.control as any).displayName, (this.control as any).label);

    // Find the relationship that uses this FK
    for (const [name, zodType] of Object.entries(parent.schema.shape)) {
      const meta = getRelationshipMetadata(zodType as any);
      if (meta && meta.foreignKey === fkName && meta.targetEntity) {
        this.targetEntity = meta.targetEntity;
        if (!this.label) {
          this.label = capitalCase(name);
        }
        debug('targetEntity %s from relationship %s, label %s', this.targetEntity, name, this.label);
        break;
      }
    }

    if (!this.targetEntity) {
      debug('no target entity found for %s', fkName);
      return;
    }

    // Resolve display property
    const metadata = this.businessObjectService.getMetadata(this.targetEntity);
    if (metadata) {
      const displayNameProp = metadata.properties.find(p => p.name === 'displayName');
      if (displayNameProp) {
        this.displayProp = 'displayName';
      } else {
        const firstString = metadata.properties.find(p => p.name !== 'id' && p.type === 'string');
        if (firstString) {
          this.displayProp = firstString.name;
        }
      }
      debug('displayProp %s', this.displayProp);
    }

    // Load entity class for queries
    this.entityClass = await this.businessObjectService.loadEntity(this.targetEntity);

    // Set initial display value
    const currentId = this.control.value;
    if (currentId != null) {
      // Check if the referenced item is included in the parent controls
      const relName = this.findRelationshipName();
      const includedControl = relName ? parent.controls?.[relName] : null;
      if (includedControl?.value?.[this.displayProp]) {
        this.inputControl.setValue(includedControl.value[this.displayProp]);
        debug('display from included: %s', this.inputControl.value);
      } else {
        // Read the single record
        try {
          const record = await this.entityClass.findById(currentId);
          this.inputControl.setValue(record?.[this.displayProp] || '');
          debug('display from findById: %s', this.inputControl.value);
        } catch (err) {
          debug('findById error %o', err);
        }
      }
    }
  }

  /** Find Relationship Name - Find the relationship property name for this FK */
  findRelationshipName(): string | null {
    const parent = (this.control as any).parent;
    if (!parent?.schema?.shape) return null;

    const fkName = (this.control as any).propertyName;
    for (const [name, zodType] of Object.entries(parent.schema.shape)) {
      const meta = getRelationshipMetadata(zodType as any);
      if (meta?.foreignKey === fkName) {
        return name;
      }
    }
    return null;
  }

  /** Search Timer */
  private searchTimer: any;

  /** Search - Query the referenced entity */
  search(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.doSearch(), 250);
  }

  /** Do Search */
  async doSearch(): Promise<void> {
    if (!this.entityClass) return;

    const filter: any = {
      order: [{ field: this.displayProp, direction: 'asc' }],
      limit: 20
    };

    const text = (this.inputControl.value || '').trim();
    if (text) {
      filter.where = { [this.displayProp]: { ilike: '%' + text + '%' } };
    }

    debug('search filter %j', filter);
    this.options = await this.entityClass.find(filter);
    this.noMatches = this.options.length === 0 && !!text;
    if (this.noMatches) {
      this.inputControl.setErrors({ noMatches: true });
      this.inputControl.markAsTouched();
    } else {
      this.inputControl.setErrors(null);
    }
    debug('options %d, noMatches %o', this.options.length, this.noMatches);
  }

  /** On Focus - Load initial options */
  async onFocus(): Promise<void> {
    if (this.options.length === 0) {
      await this.search();
    }
  }

  /** Select Option - Set the FK value */
  selectOption(option: any): void {
    this.control.setValue(option.id);
    this.inputControl.setValue(option[this.displayProp] || '');
    this.control.markAsDirty();
    this.noMatches = false;
    this.inputControl.setErrors(null);
    debug('selected %s = %o', this.displayProp, option.id);
  }

  /** Get Display - Display function for autocomplete */
  getDisplay(option: any): string {
    if (!option) return '';
    if (typeof option === 'object') return option[this.displayProp] || '';
    return this.inputControl.value || '';
  }

  /** On Input - Handle text changes for search */
  onInput(): void {
    this.search();
  }

  /** Input Element Reference */
  inputEl: any;

  /** Open Dropdown - Focus input to trigger autocomplete */
  async openDropdown(): Promise<void> {
    await this.doSearch();
    this.inputEl?.focus();
  }

  /** Clear - Clear the selection */
  clear(): void {
    this.control.setValue(null);
    this.inputControl.setValue('');
    this.inputControl.setErrors(null);
    this.control.markAsDirty();
    this.options = [];
    this.noMatches = false;
  }
}

applyTemplate(SfReferenceFieldComponent, [
  {
    element: 'mat-form-field',
    attributes: { style: 'width: 100%' },
    contains: [
      {
        element: 'mat-label',
        text: '{{label}}'
      },
      {
        element: 'input',
        name: 'inputEl',
        referenceable: true,
        attributes: {
          matInput: null,
          formControl: '<- inputControl',
          matAutocomplete: '<- auto',
          input: '-> onInput()',
          focus: '-> onFocus()'
        }
      },
      {
        if: 'inputControl.value',
        name: 'clearSection',
        contains: [
          {
            element: 'button',
            name: 'clearButton',
            attributes: { 'mat-icon-button': null, matSuffix: null, click: '-> clear()' },
            contains: [{ 'mat-icon': 'close' }]
          }
        ]
      },
      {
        element: 'button',
        name: 'dropdownButton',
        attributes: { 'mat-icon-button': null, matSuffix: null, click: '-> openDropdown()' },
        contains: [{ 'mat-icon': 'arrow_drop_down' }]
      },
      {
        element: 'mat-autocomplete',
        name: 'auto',
        referenceable: true,
        attributes: {
          autoActiveFirstOption: '<- true',
          optionSelected: '-> selectOption($event.option.value)'
        },
        contains: [
          {
            for: 'option',
            of: 'options',
            contains: [
              {
                element: 'mat-option',
                text: '{{option[displayProp]}}',
                attributes: { value: '<- option' }
              }
            ]
          }
        ]
      },
      { element: 'mat-error', text: 'No matches found' }
    ]
  }
]);
