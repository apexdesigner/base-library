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

applyTemplate(TestPage, [
  {
    element: 'flex-column',
    contains: [
      {
        element: 'mat-form-field',
        contains: [
          { 'mat-label': 'Dialog Title' },
          {
            element: 'input',
            matInput: true,
            ngModel: '= dialogTitle',
            ngModelChange: '-> dialogTitle = ngModel',
          },
        ],
      },
      {
        element: 'button',
        'mat-button': true,
        text: 'Open Dialog',
        click: '-> openDialog()',
      },
      {
        element: 'test-dialog',
        name: 'testDialog',
        title: '= dialogTitle',
        options: "= { width: '400px' }",
        saved: '-> onSaved()',
      },
    ],
  },
]);
