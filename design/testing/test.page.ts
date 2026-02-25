import { Page, page, applyTemplate } from "@apexdesigner/dsl/page";
import { TestDialogComponent } from "@components";

@page({
  path: "/test",
})
export class TestPage extends Page {

  dialogTitle: string = 'Hello';

  testDialog!: TestDialogComponent;

  openDialog() {
    this.testDialog.open();
  }

  onSaved() {
    console.log('saved');
  }
}

applyTemplate(TestPage, `
  <flex-column>
    <mat-form-field>
      <mat-label>Dialog Title</mat-label>
      <input matInput [(ngModel)]="dialogTitle">
    </mat-form-field>
    <button mat-button (click)="openDialog()">Open Dialog</button>
    <test-dialog
      #testDialog
      [title]="dialogTitle"
      [options]="{ width: '400px' }"
      (saved)="onSaved()">
    </test-dialog>
  </flex-column>
`);
