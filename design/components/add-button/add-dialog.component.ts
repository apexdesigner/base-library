import {
  Component,
  component,
  property,
  method,
  applyTemplate,
} from "@apexdesigner/dsl/component";
import { MatDialogRef } from "@angular/material/dialog";
import { EventEmitter } from "@angular/core";
import { PersistedArray, PersistedFormArray, PersistedFormGroup } from "@business-objects-client";
import { BusinessObjectService } from "@services";
import { AddButtonComponent } from "@components";
import createDebug from "debug";

const debug = createDebug("AddDialogComponent");

@component({ isDialog: true, parentComponent: AddButtonComponent })
export class AddDialogComponent extends Component {
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  @property({ isInput: true })
  label!: string;

  @property({ isOutput: true })
  added!: EventEmitter<any>;

  dialog!: MatDialogRef<any>;
  formGroup!: PersistedFormGroup;
  saving!: boolean;
  businessObjectService!: BusinessObjectService;

  @method({ callOnLoad: true })
  async initialize() {
    debug('entityName', this.array.entityName);

    this.formGroup = await this.businessObjectService.loadFormGroup(
      this.array.entityName
    );

    debug('formGroup', this.formGroup);
  }

  async save() {
    debug('payload', this.formGroup.getPayload());

    this.saving = true;
    try {
      await this.array.add(this.formGroup.getPayload());
      if (this.array instanceof PersistedFormArray) {
        const added = this.array.at(this.array.length - 1);
        debug('added form group', added);

        this.added.emit(added);
      } else {
        const added = this.array[this.array.length - 1];
        debug('added entity', added);

        this.added.emit(added);
      }
      this.dialog.close();
    } finally {
      this.saving = false;
    }
  }

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
