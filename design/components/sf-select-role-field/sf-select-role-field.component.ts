import {
  Component,
  property,
  method,
  applyTemplate,
} from '@apexdesigner/dsl/component';
import { Role } from '@business-objects-client';

/**
 * SF Select Role Field
 *
 * Schema form field that displays a dropdown of roles.
 * The control value is the role id.
 */
export class SfSelectRoleFieldComponent extends Component {
  /** Control - The schema form control bound to this field */
  @property({ isInput: true })
  control!: any;

  /** Label - Label text to override the control's display name */
  @property({ isInput: true })
  label?: string;

  /** Placeholder - Placeholder text */
  @property({ isInput: true })
  placeholder?: string;

  /** Roles - Loaded list of roles */
  roles!: Array<{ id: number; name: string; displayName: string }>;

  /** Load - Fetch roles on init */
  @method({ callOnLoad: true })
  async load(): Promise<void> {
    const results = await Role.find({ order: [{ field: 'name', direction: 'asc' }] });
    this.roles = results.map((r: any) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName || r.name,
    }));
  }
}

applyTemplate(
  SfSelectRoleFieldComponent,
  `
  <mat-form-field>
    <mat-label>{{label || control.displayName}}</mat-label>
    <mat-select [formControl]="control" [placeholder]="placeholder || control.placeholder">
      <for const="role" of="roles">
        <mat-option [value]="role.id">
          {{role.displayName}}
        </mat-option>
      </for>
    </mat-select>
    <if condition="control.value">
      <button matSuffix mat-icon-button (click)="control.setValue(null); $event.stopPropagation()">
        <mat-icon>close</mat-icon>
      </button>
    </if>
  </mat-form-field>
`,
);
