import { Component, component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { User } from '@business-objects-client';
import { SchemaFormControl } from '@apexdesigner/schema-forms';

/**
 * Select User Field
 *
 * Schema form field that displays a dropdown of users.
 * The control value is the user id.
 */
@component({ fieldFormat: 'select-user' })
export class SelectUserFieldComponent extends Component {
  /** Control - The schema form control bound to this field */
  @property({ isInput: true })
  control!: SchemaFormControl;

  /** Label - Label text to override the control's display name */
  @property({ isInput: true })
  label?: string;

  /** Placeholder - Placeholder text */
  @property({ isInput: true })
  placeholder?: string;

  /** Hide Help Text - Whether to hide the help text below the field */
  @property({ isInput: true })
  hideHelpText?: boolean;

  /** Users - Loaded list of users */
  users!: Array<{ id: number | string; email: string }>;

  /** Load - Fetch users on init */
  @method({ callOnLoad: true })
  async load(): Promise<void> {
    const results = await User.find({ order: [{ field: 'email', direction: 'asc' }] });
    this.users = results.map((u: any) => ({ id: u.id, email: u.email }));
  }
}

applyTemplate(SelectUserFieldComponent, [
  {
    element: 'mat-form-field',
    contains: [
      { 'mat-label': "{{label || 'User'}}" },
      {
        element: 'mat-select',
        attributes: { formControl: '<- control', placeholder: '<- placeholder || control.placeholder' },
        contains: [
          {
            for: 'user',
            of: 'users',
            contains: [
              {
                element: 'mat-option',
                text: '{{user.email}}',
                attributes: { value: '<- user.id' }
              }
            ]
          }
        ]
      },
      {
        if: 'control.value',
        contains: [
          {
            element: 'button',
            attributes: {
              matSuffix: null,
              'mat-icon-button': null,
              disabled: '<- control.disabled',
              click: '-> control.setValue(null); $event.stopPropagation()'
            },
            contains: [{ 'mat-icon': 'close' }]
          }
        ]
      }
    ]
  }
]);
