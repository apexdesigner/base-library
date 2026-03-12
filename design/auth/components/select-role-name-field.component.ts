import { Component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { Role } from '@business-objects-client';
import { SchemaFormControl } from '@apexdesigner/schema-forms';

/**
 * Select Role Name Field
 *
 * Schema form field that displays a dropdown of roles.
 * The control value is the role name.
 */
export class SelectRoleNameFieldComponent extends Component {
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
  roles!: Array<{ name: string; displayName: string }>;

  /** Load - Fetch roles on init */
  @method({ callOnLoad: true })
  async load(): Promise<void> {
    const results = await Role.find({ order: [{ field: 'name', direction: 'asc' }] });
    this.roles = results.map((r: any) => ({
      name: r.name,
      displayName: r.displayName || r.name
    }));
  }
}

applyTemplate(
  SelectRoleNameFieldComponent,
  `
  <mat-form-field>
    <mat-label>{{label || 'Role'}}</mat-label>
    <mat-select [formControl]="control" [placeholder]="placeholder || control.placeholder">
      <for const="role" of="roles">
        <mat-option [value]="role.name">
          {{role.displayName}}
        </mat-option>
      </for>
    </mat-select>
    <if condition="control.value">
      <button matSuffix mat-icon-button [disabled]="control.disabled" (click)="control.setValue(null); $event.stopPropagation()">
        <mat-icon>close</mat-icon>
      </button>
    </if>
  </mat-form-field>
`
);
