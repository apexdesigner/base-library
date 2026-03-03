import {
  Component,
  component,
  property,
  method,
  applyTemplate,
} from "@apexdesigner/dsl/component";
import { EventEmitter } from "@angular/core";
import { PersistedArray, PersistedFormArray, PersistedFormGroup } from "@business-objects-client";
import { AddDialogComponent } from "@components";
import { capitalCase } from "change-case";
import createDebug from "debug";

const debug = createDebug("AddButtonComponent");

export class AddButtonComponent extends Component {
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  @property({ isInput: true })
  label!: string;

  @property({ isInput: true })
  dialogWidth!: string;

  @property({ isOutput: true })
  added!: EventEmitter<any>;

  defaultLabel!: string;

  @method({ callOnLoad: true })
  initialize() {
    if (!this.label && this.array?.entityName) {
      this.defaultLabel = 'Add ' + capitalCase(this.array.entityName);
    }

    debug('defaultLabel', this.defaultLabel);
  }
}

applyTemplate(
  AddButtonComponent,
  `
  <add-dialog #addDialog [array]="array" [label]="label || defaultLabel" [options]="{ autoFocus: true, width: dialogWidth || '400px' }" (added)="added.emit($event)"></add-dialog>
  <button mat-raised-button color="primary" (click)="addDialog.open()">
    <mat-icon>add</mat-icon>
    {{ label || defaultLabel || 'Add' }}
  </button>
`,
);
