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

/**
 * Add Button
 *
 * A button that opens a dialog for adding a new record to a persisted array.
 * Renders a Material raised button with an add icon. When clicked, opens an
 * AddDialog that dynamically loads a schema-driven form for the array's entity type.
 */
export class AddButtonComponent extends Component {
  /** The persisted array or form array to add new records to. */
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  /** Custom label for the button and dialog title. Defaults to "Add {EntityName}". */
  @property({ isInput: true })
  label?: string;

  /** Custom width for the add dialog. Defaults to '400px'. */
  @property({ isInput: true })
  dialogWidth?: string;

  /** Emits the newly added entity or form group after a successful add. */
  @property({ isOutput: true })
  added?: EventEmitter<any>;

  defaultLabel!: string;

  /** Sets the default label from the array's entity name if no custom label is provided. */
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
