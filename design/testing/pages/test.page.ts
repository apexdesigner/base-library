import { Page, page, applyTemplate } from '@apexdesigner/dsl/page';
import { TestDialogComponent } from '@components';

/**
 * Test
 *
 * Root test page.
 */
@page({
  path: '/test'
})
export class TestPage extends Page {
  /** Dialog Title - Title for the test dialog */
  dialogTitle: string = 'Hello';

  /** Test Dialog - Reference to the test dialog component */
  testDialog!: TestDialogComponent;

  /** Open Dialog - Opens the test dialog */
  openDialog() {
    this.testDialog.open();
  }

  /** On Saved - Handles the dialog saved event */
  onSaved() {
    console.log('saved');
  }
}

applyTemplate(
  TestPage,
  `
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
`
);
