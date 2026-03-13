import { Component, component, property, applyTemplate } from '@apexdesigner/dsl/component';
import { MatDialogRef } from '@angular/material/dialog';
import { EventEmitter } from '@angular/core';
import { Validators } from '@angular/forms';

/**
 * Test Dialog
 *
 * Dialog component for testing.
 */
@component({ isDialog: true, metadata: { category: 'testing', version: 1 } })
export class TestDialogComponent extends Component {
  /** Title - Dialog title text */
  @property({ isInput: true })
  title!: string;

  /** Saved - Event emitted when the dialog saves */
  @property({ isOutput: true })
  saved!: EventEmitter<void>;

  /** Dialog - Reference to the dialog instance */
  dialog!: MatDialogRef<any>;

  /** Cancel - Closes the dialog without saving */
  cancel() {
    this.dialog.close();
  }

  /** Save - Emits the saved event and closes the dialog */
  save() {
    this.saved.emit();
    this.dialog.close();
  }
}

applyTemplate(
  TestDialogComponent,
  `
  <h2 mat-dialog-title>{{ title }}</h2>
  <div mat-dialog-content>
    <p>Test dialog content</p>
  </div>
  <div mat-dialog-actions>
    <button mat-button (click)="cancel()">Cancel</button>
    <button mat-button (click)="save()">Save</button>
  </div>
`
);
