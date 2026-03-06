import {
  Component,
  property,
  method,
  applyTemplate,
} from '@apexdesigner/dsl/component';
import { User } from '@business-objects-client';
import { SchemaFormControl } from '@apexdesigner/schema-forms';

/**
 * Select User Field
 *
 * Schema form field that displays a dropdown of users.
 * The control value is the user id.
 */
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

  /** Users - Loaded list of users */
  users!: Array<{ id: number | string; email: string }>;

  /** Load - Fetch users on init */
  @method({ callOnLoad: true })
  async load(): Promise<void> {
    const results = await User.find({ order: [{ field: 'email', direction: 'asc' }] });
    this.users = results.map((u: any) => ({ id: u.id, email: u.email }));
  }
}

applyTemplate(
  SelectUserFieldComponent,
  `
  <mat-form-field>
    <mat-label>{{label || 'User'}}</mat-label>
    <mat-select [formControl]="control" [placeholder]="placeholder || control.placeholder">
      <for const="user" of="users">
        <mat-option [value]="user.id">
          {{user.email}}
        </mat-option>
      </for>
    </mat-select>
    <if condition="control.value">
      <button matSuffix mat-icon-button [disabled]="control.disabled" (click)="control.setValue(null); $event.stopPropagation()">
        <mat-icon>close</mat-icon>
      </button>
    </if>
  </mat-form-field>
`,
);
