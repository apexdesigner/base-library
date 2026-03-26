import { Component, component, property, applyTemplate } from '@apexdesigner/dsl/component';
import { EventEmitter } from '@angular/core';

/**
 * Confirmation Dialog
 *
 * A simple Material dialog that displays a message with Cancel and Confirm buttons.
 * Used by the confirm directive to prompt the user before destructive actions.
 */
@component({ isDialog: true })
export class ConfirmationDialogComponent extends Component {
  /** Message - The confirmation message to display */
  @property({ isInput: true })
  message!: string;

  /** Confirmed - Emitted when the user clicks Confirm */
  @property({ isOutput: true })
  confirmed!: EventEmitter<void>;

  /** Canceled - Emitted when the user clicks Cancel */
  @property({ isOutput: true })
  canceled!: EventEmitter<void>;

  /** Confirm Action */
  confirmAction(): void {
    this.confirmed.emit();
  }

  /** Cancel Action */
  cancelAction(): void {
    this.canceled.emit();
  }
}

applyTemplate(ConfirmationDialogComponent, [
  { 'mat-dialog-content': [{ element: 'p', text: '{{message}}' }] },
  {
    'mat-dialog-actions': [
      {
        element: 'button',
        name: 'cancelButton',
        text: 'Cancel',
        attributes: { 'mat-button': null, click: '-> cancelAction()' }
      },
      {
        element: 'button',
        name: 'confirmButton',
        text: 'Confirm',
        attributes: { 'mat-raised-button': null, color: 'warn', click: '-> confirmAction()' }
      }
    ]
  }
]);
