import { Component, component, property, applyTemplate } from "@apexdesigner/dsl/component";
import { MatDialogRef } from "@angular/material/dialog";
import { EventEmitter } from "@angular/core";
import { Validators } from "@angular/forms";

@component({ isDialog: true })
export class TestDialogComponent extends Component {

  @property({ isInput: true })
  title!: string;

  @property({ isOutput: true })
  saved!: EventEmitter<void>;

  dialog!: MatDialogRef<any>;

  cancel() {
    this.dialog.close();
  }

  save() {
    this.saved.emit();
    this.dialog.close();
  }
}

applyTemplate(TestDialogComponent, `
  <h2 mat-dialog-title>{{ title }}</h2>
  <div mat-dialog-content>
    <p>Test dialog content</p>
  </div>
  <div mat-dialog-actions>
    <button mat-button (click)="cancel()">Cancel</button>
    <button mat-button (click)="save()">Save</button>
  </div>
`);
