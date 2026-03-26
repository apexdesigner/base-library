import { Component, component, property, applyTemplate } from '@apexdesigner/dsl/component';

/**
 * Error Dialog
 *
 * A Material dialog that displays a list of error messages.
 * Provides a Close button that clears the messages and closes the dialog.
 */
@component({ isDialog: true })
export class ErrorDialogComponent extends Component {
  /** Messages - Array of error message strings to display */
  @property({ isInput: true })
  messages!: string[];

  /** Close - Clear messages and close the dialog */
  close(): void {
    this.messages = [];
  }
}

applyTemplate(ErrorDialogComponent, [
  {
    'mat-dialog-content': [
      {
        for: 'message',
        of: 'messages',
        contains: [{ element: 'div', text: '{{message}}' }],
      },
    ],
  },
  {
    'mat-dialog-actions': [
      {
        element: 'button',
        name: 'closeButton',
        text: 'Close',
        attributes: { 'mat-button': null, click: '-> close()' },
      },
    ],
  },
]);
