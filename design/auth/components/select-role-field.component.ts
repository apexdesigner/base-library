import { Component, component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { Role } from '@business-objects-client';
import { SchemaFormControl } from '@apexdesigner/schema-forms';

/**
 * Select Role Field
 *
 * Schema form field that displays a dropdown of roles.
 * The control value is the role id.
 */
@component({ metadata: { schemaFormsField: true } })
export class SelectRoleFieldComponent extends Component {
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

  /** Roles - Loaded list of roles */
  roles!: Array<{ id: number; name: string; displayName: string }>;

  /** Load - Fetch roles on init */
  @method({ callOnLoad: true })
  async load(): Promise<void> {
    const results = await Role.find({ order: [{ field: 'name', direction: 'asc' }] });
    this.roles = results.map((r: any) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName || r.name
    }));
  }
}

applyTemplate(SelectRoleFieldComponent, [
  {
    element: 'mat-form-field',
    contains: [
      { 'mat-label': "{{label || 'Role'}}" },
      {
        element: 'mat-select',
        formControl: '= control',
        placeholder: '= placeholder || control.placeholder',
        contains: [
          {
            for: 'role',
            of: 'roles',
            contains: [
              {
                element: 'mat-option',
                value: '= role.id',
                text: '{{role.displayName}}',
              },
            ],
          },
        ],
      },
      {
        if: 'control.value',
        contains: [
          {
            element: 'button',
            matSuffix: true,
            'mat-icon-button': true,
            disabled: '= control.disabled',
            click: '-> control.setValue(null); $event.stopPropagation()',
            contains: [{ 'mat-icon': 'close' }],
          },
        ],
      },
    ],
  },
]);
