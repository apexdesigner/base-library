import { Component, component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { MatDialogRef } from '@angular/material/dialog';
import { EventEmitter } from '@angular/core';
import { PersistedArray, PersistedFormArray, PersistedFormGroup } from '@business-objects-client';
import { BusinessObjectService } from '@services';
import { AddButtonComponent } from '@components';
import createDebug from 'debug';

const debug = createDebug('AddDialogComponent');

/**
 * Add Dialog
 *
 * Dialog for adding a new record to a persisted array. Dynamically loads a
 * schema-driven form using BusinessObjectService based on the array's entity name.
 * Hidden fields are automatically disabled so they don't block form validity.
 */
@component({ isDialog: true, parentComponent: AddButtonComponent })
export class AddDialogComponent extends Component {
  /** The persisted array or form array to add new records to. */
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  /** Title displayed in the dialog header. */
  @property({ isInput: true })
  label?: string;

  /** Emits the newly added entity or form group after a successful add. */
  @property({ isOutput: true })
  added?: EventEmitter<any>;

  /** Dialog - Reference to the dialog instance */
  dialog!: MatDialogRef<any>;
  /** Form Group - Reactive form group for the dialog fields */
  formGroup!: PersistedFormGroup;
  /** Saving - Whether the dialog is currently saving */
  saving!: boolean;
  /** Business Object Service - Service for CRUD operations */
  businessObjectService!: BusinessObjectService;

  /** Loads the form group for the array's entity type. */
  @method({ callOnLoad: true })
  async initialize() {
    debug('entityName', this.array.entityName);

    this.formGroup = await this.businessObjectService.loadFormGroup(this.array.entityName);

    debug('formGroup', this.formGroup);
  }

  /** Adds the form payload to the array, emits the new record, and closes the dialog. */
  async save() {
    debug('payload', this.formGroup.getPayload());

    this.saving = true;
    try {
      await this.array.add(this.formGroup.getPayload());
      if (this.array instanceof PersistedFormArray) {
        const added = this.array.at(this.array.length - 1);
        debug('added form group', added);

        this.added?.emit(added);
      } else {
        const added = this.array[this.array.length - 1];
        debug('added entity', added);

        this.added?.emit(added);
      }
      this.dialog.close();
    } finally {
      this.saving = false;
    }
  }

  /** Closes the dialog without saving. */
  cancel() {
    this.dialog.close();
  }
}

applyTemplate(
  AddDialogComponent,
  `
  <h2 mat-dialog-title>{{ label || 'Add' }}</h2>
  <div mat-dialog-content>
    <if condition="formGroup">
      <sf-fields [group]="formGroup" [disableHidden]="true"></sf-fields>
    </if>
  </div>
  <div mat-dialog-actions>
    <button mat-button (click)="cancel()">Cancel</button>
    <button mat-raised-button color="primary" (click)="save()" [disabled]="saving || !formGroup || (formGroup.statusChanges | async) !== 'VALID'">Add</button>
  </div>
`
);
